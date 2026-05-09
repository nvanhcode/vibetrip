import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ConversationRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type MessageRole = "user" | "assistant";

type ChatAttachment = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  source: "event_record" | "route_stop";
  recordId: string | null;
  routeId: string | null;
};

type MessageRow = {
  id: string;
  role: MessageRole;
  content: string;
  attachments: unknown;
  created_at: string;
};

type EventContextRow = {
  id: string;
  event_name: string;
  event_type: string;
  event_description: string;
  goong_latitude: number;
  goong_longitude: number;
  organized_at: string | null;
  opens_at: string | null;
  closes_at: string | null;
};

type RouteContextRow = {
  id: string;
  title: string;
  start_date: string;
  origin_label: string;
  origin_latitude: number;
  origin_longitude: number;
  summary: string | null;
};

type StopContextRow = {
  id: string;
  route_id: string;
  position: number;
  stop_kind: "origin" | "record";
  label: string;
  latitude: number;
  longitude: number;
  event_record_id: string | null;
};

type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type ApiMessage = {
  id: string;
  role: MessageRole;
  content: string;
  attachments: ChatAttachment[];
  createdAt: string;
};

type AiRequestBody = {
  prompt?: string;
  conversationId?: string;
  userLocation?: {
    latitude?: number;
    longitude?: number;
  } | null;
  mapViewport?: {
    minLat?: number;
    maxLat?: number;
    minLng?: number;
    maxLng?: number;
    zoom?: number;
  } | null;
};

type ClientUserLocation = {
  latitude: number;
  longitude: number;
};

type ClientMapViewport = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  zoom: number | null;
};

type ClientMapContext = {
  userLocation: ClientUserLocation | null;
  viewport: ClientMapViewport | null;
};

type AiReference = {
  source: "event_record" | "route_stop";
  id: string;
};

type AiResponsePayload = {
  answer: string;
  references: AiReference[];
};

const AI_RESPONSE_SCHEMA = {
  name: "map_ai_chat_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      answer: {
        type: "string",
      },
      references: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            source: {
              type: "string",
              enum: ["event_record", "route_stop"],
            },
            id: {
              type: "string",
            },
          },
          required: ["source", "id"],
        },
      },
    },
    required: ["answer", "references"],
  },
} as const;

function normalizeConversationTitle(input: string) {
  return input.replaceAll(/\s+/g, " ").trim().slice(0, 120) || "Cuộc trò chuyện mới";
}

function normalizePrompt(input: unknown) {
  if (typeof input !== "string") {
    return "";
  }

  return input.trim();
}

function normalizeClientMapContext(payload: AiRequestBody): ClientMapContext {
  const rawLocation = payload.userLocation;
  const locationLat =
    rawLocation && typeof rawLocation === "object" ? rawLocation.latitude : undefined;
  const locationLng =
    rawLocation && typeof rawLocation === "object" ? rawLocation.longitude : undefined;
  const hasLocation =
    rawLocation &&
    typeof rawLocation === "object" &&
    typeof locationLat === "number" &&
    Number.isFinite(locationLat) &&
    typeof locationLng === "number" &&
    Number.isFinite(locationLng);

  const userLocation = hasLocation
    ? {
        latitude: locationLat,
        longitude: locationLng,
      }
    : null;

  const rawViewport = payload.mapViewport;
  const viewportMinLat =
    rawViewport && typeof rawViewport === "object" ? rawViewport.minLat : undefined;
  const viewportMaxLat =
    rawViewport && typeof rawViewport === "object" ? rawViewport.maxLat : undefined;
  const viewportMinLng =
    rawViewport && typeof rawViewport === "object" ? rawViewport.minLng : undefined;
  const viewportMaxLng =
    rawViewport && typeof rawViewport === "object" ? rawViewport.maxLng : undefined;
  const hasViewport =
    rawViewport &&
    typeof rawViewport === "object" &&
    typeof viewportMinLat === "number" &&
    Number.isFinite(viewportMinLat) &&
    typeof viewportMaxLat === "number" &&
    Number.isFinite(viewportMaxLat) &&
    typeof viewportMinLng === "number" &&
    Number.isFinite(viewportMinLng) &&
    typeof viewportMaxLng === "number" &&
    Number.isFinite(viewportMaxLng) &&
    viewportMinLat <= viewportMaxLat &&
    viewportMinLng <= viewportMaxLng;

  const zoom =
    rawViewport &&
    typeof rawViewport === "object" &&
    typeof rawViewport.zoom === "number" &&
    Number.isFinite(rawViewport.zoom)
      ? rawViewport.zoom
      : null;

  const viewport = hasViewport
    ? {
        minLat: viewportMinLat,
        maxLat: viewportMaxLat,
        minLng: viewportMinLng,
        maxLng: viewportMaxLng,
        zoom,
      }
    : null;

  return {
    userLocation,
    viewport,
  };
}

function parseAttachments(value: unknown): ChatAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is ChatAttachment => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const attachment = item as Partial<ChatAttachment>;
    return (
      typeof attachment.id === "string" &&
      typeof attachment.label === "string" &&
      typeof attachment.latitude === "number" &&
      Number.isFinite(attachment.latitude) &&
      typeof attachment.longitude === "number" &&
      Number.isFinite(attachment.longitude) &&
      (attachment.source === "event_record" || attachment.source === "route_stop")
    );
  });
}

function toConversationSummary(row: ConversationRow): ConversationSummary {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toApiMessage(row: MessageRow): ApiMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    attachments: parseAttachments(row.attachments),
    createdAt: row.created_at,
  };
}

function buildContextPayload(events: EventContextRow[], routes: RouteContextRow[], stops: StopContextRow[]) {
  const stopsByRoute = new Map<string, StopContextRow[]>();

  for (const stop of stops) {
    const items = stopsByRoute.get(stop.route_id) ?? [];
    items.push(stop);
    stopsByRoute.set(stop.route_id, items);
  }

  return {
    events: events.map((event) => ({
      id: event.id,
      name: event.event_name,
      type: event.event_type,
      description: event.event_description,
      latitude: event.goong_latitude,
      longitude: event.goong_longitude,
      organizedAt: event.organized_at,
      opensAt: event.opens_at,
      closesAt: event.closes_at,
    })),
    personalRoutes: routes.map((route) => ({
      id: route.id,
      title: route.title,
      startDate: route.start_date,
      summary: route.summary,
      origin: {
        label: route.origin_label,
        latitude: route.origin_latitude,
        longitude: route.origin_longitude,
      },
      stops: (stopsByRoute.get(route.id) ?? []).map((stop) => ({
        id: stop.id,
        position: stop.position,
        kind: stop.stop_kind,
        label: stop.label,
        latitude: stop.latitude,
        longitude: stop.longitude,
        eventRecordId: stop.event_record_id,
      })),
    })),
  };
}

function parseAiResponse(raw: string): AiResponsePayload {
  const parsed = JSON.parse(raw) as Partial<AiResponsePayload>;
  const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
  const references = Array.isArray(parsed.references)
    ? parsed.references.filter((item): item is AiReference => {
        return Boolean(
          item &&
            (item.source === "event_record" || item.source === "route_stop") &&
            typeof item.id === "string" &&
            item.id.trim().length > 0,
        );
      })
    : [];

  return {
    answer: answer || "Mình chưa có đủ dữ liệu trong hệ thống để trả lời câu hỏi này.",
    references,
  };
}

async function loadConversations(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("map_ai_conversations")
    .select("id, title, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(40);

  if (error || !Array.isArray(data)) {
    return [] as ConversationSummary[];
  }

  return (data as ConversationRow[]).map(toConversationSummary);
}

async function loadConversationMessages(userId: string, conversationId: string) {
  const supabase = await createClient();

  const { data: ownerRow, error: ownerError } = await supabase
    .from("map_ai_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (ownerError || !ownerRow) {
    return null;
  }

  const { data: messages, error: messageError } = await supabase
    .from("map_ai_messages")
    .select("id, role, content, attachments, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(120);

  if (messageError || !Array.isArray(messages)) {
    return [] as ApiMessage[];
  }

  return (messages as MessageRow[]).map(toApiMessage);
}

async function fetchContextData(userId: string) {
  const supabase = await createClient();

  const { data: eventRows } = await supabase
    .from("event_records")
    .select(
      "id, event_name, event_type, event_description, goong_latitude, goong_longitude, organized_at, opens_at, closes_at",
    )
    .eq("is_approved", true)
    .not("goong_latitude", "is", null)
    .not("goong_longitude", "is", null)
    .order("organized_at", { ascending: false })
    .limit(180);

  const { data: routeRows } = await supabase
    .from("user_routes")
    .select(
      "id, title, start_date, origin_label, origin_latitude, origin_longitude, summary",
    )
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(120);

  const routes = (routeRows ?? []) as RouteContextRow[];
  const routeIds = routes.map((item) => item.id);

  let stops: StopContextRow[] = [];

  if (routeIds.length > 0) {
    const { data: stopRows } = await supabase
      .from("user_route_stops")
      .select("id, route_id, position, stop_kind, label, latitude, longitude, event_record_id")
      .in("route_id", routeIds)
      .order("position", { ascending: true });

    stops = (stopRows ?? []) as StopContextRow[];
  }

  return {
    events: (eventRows ?? []) as EventContextRow[],
    routes,
    stops,
  };
}

async function resolveConversationId(
  userId: string,
  incomingConversationId: string | undefined,
  prompt: string,
) {
  const supabase = await createClient();

  if (incomingConversationId) {
    const { data: ownedConversation, error } = await supabase
      .from("map_ai_conversations")
      .select("id")
      .eq("id", incomingConversationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !ownedConversation?.id) {
      return null;
    }

    return ownedConversation.id;
  }

  const title = normalizeConversationTitle(prompt);

  const { data: insertedConversation, error: insertError } = await supabase
    .from("map_ai_conversations")
    .insert({
      user_id: userId,
      title,
    })
    .select("id")
    .single();

  if (insertError || !insertedConversation?.id) {
    return null;
  }

  return insertedConversation.id;
}

function buildAttachmentMap(events: EventContextRow[], routes: RouteContextRow[], stops: StopContextRow[]) {
  const eventMap = new Map<string, ChatAttachment>();
  const routeTitleMap = new Map(routes.map((route) => [route.id, route.title]));
  const stopMap = new Map<string, ChatAttachment>();

  for (const event of events) {
    eventMap.set(event.id, {
      id: event.id,
      label: event.event_name || "Địa điểm",
      latitude: event.goong_latitude,
      longitude: event.goong_longitude,
      source: "event_record",
      recordId: event.id,
      routeId: null,
    });
  }

  for (const stop of stops) {
    stopMap.set(stop.id, {
      id: stop.id,
      label: `${stop.label} (${routeTitleMap.get(stop.route_id) ?? "Lộ trình cá nhân"})`,
      latitude: stop.latitude,
      longitude: stop.longitude,
      source: "route_stop",
      recordId: stop.event_record_id,
      routeId: stop.route_id,
    });
  }

  return { eventMap, stopMap };
}

async function generateAssistantMessage(params: {
  prompt: string;
  recentMessages: ApiMessage[];
  events: EventContextRow[];
  routes: RouteContextRow[];
  stops: StopContextRow[];
  clientMapContext: ClientMapContext;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  if (!apiKey) {
    throw new Error("Thiếu OPENAI_API_KEY trên server.");
  }

  const openai = new OpenAI({ apiKey });
  const contextPayload = {
    ...buildContextPayload(params.events, params.routes, params.stops),
    clientMapContext: {
      currentUserLocation: params.clientMapContext.userLocation,
      currentViewport: params.clientMapContext.viewport,
    },
  };

  const conversationMessages = params.recentMessages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: {
      type: "json_schema",
      json_schema: AI_RESPONSE_SCHEMA,
    },
    messages: [
      {
        role: "system",
        content:
          "Bạn là trợ lý AI cho bản đồ du lịch nội bộ. Chỉ được dùng đúng dữ liệu trong CONTEXT_DB. Không suy đoán, không dùng kiến thức ngoài, không bịa thông tin. Nếu câu hỏi vượt ngoài dữ liệu, hãy nói rõ không có dữ liệu trong hệ thống. Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu.",
      },
      {
        role: "system",
        content:
          "Khi cần đính kèm địa điểm, chỉ trả về references bằng id có trong CONTEXT_DB. Tuyệt đối không tự tạo id hoặc tọa độ. Tọa độ sẽ do server gắn từ DB.",
      },
      {
        role: "system",
        content: `CONTEXT_DB=${JSON.stringify(contextPayload)}`,
      },
      ...conversationMessages,
      {
        role: "user",
        content: params.prompt,
      },
    ],
  });

  const rawContent = completion.choices[0]?.message?.content?.trim();

  if (!rawContent) {
    return {
      answer: "Mình chưa thể xử lý yêu cầu này ngay lúc này.",
      references: [] as AiReference[],
    };
  }

  return parseAiResponse(rawContent);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId")?.trim() ?? "";

  const conversations = await loadConversations(user.id);

  if (!conversationId) {
    return NextResponse.json({ conversations, messages: [] }, { status: 200 });
  }

  const messages = await loadConversationMessages(user.id, conversationId);

  if (messages === null) {
    return NextResponse.json(
      { error: "Không tìm thấy cuộc trò chuyện." },
      { status: 404 },
    );
  }

  return NextResponse.json({ conversations, messages }, { status: 200 });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: AiRequestBody;

  try {
    payload = (await request.json()) as AiRequestBody;
  } catch {
    return NextResponse.json({ error: "Payload không hợp lệ." }, { status: 400 });
  }

  const prompt = normalizePrompt(payload.prompt);
  const clientMapContext = normalizeClientMapContext(payload);

  if (prompt.length < 2) {
    return NextResponse.json({ error: "Vui lòng nhập nội dung chat." }, { status: 400 });
  }

  const conversationId = await resolveConversationId(
    user.id,
    payload.conversationId?.trim() || undefined,
    prompt,
  );

  if (!conversationId) {
    return NextResponse.json(
      { error: "Không thể mở cuộc trò chuyện." },
      { status: 404 },
    );
  }

  const { data: recentRows } = await supabase
    .from("map_ai_messages")
    .select("id, role, content, attachments, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(12);

  const recentMessages = ((recentRows ?? []) as MessageRow[])
    .reverse()
    .map(toApiMessage);

  const { error: insertUserMessageError } = await supabase
    .from("map_ai_messages")
    .insert({
      conversation_id: conversationId,
      role: "user",
      content: prompt,
      attachments: [],
    });

  if (insertUserMessageError) {
    return NextResponse.json(
      { error: "Không thể lưu tin nhắn người dùng." },
      { status: 500 },
    );
  }

  try {
    const { events, routes, stops } = await fetchContextData(user.id);
    const aiOutput = await generateAssistantMessage({
      prompt,
      recentMessages,
      events,
      routes,
      stops,
      clientMapContext,
    });

    const { eventMap, stopMap } = buildAttachmentMap(events, routes, stops);
    const dedupKeys = new Set<string>();

    const attachments = aiOutput.references
      .map((reference) => {
        if (reference.source === "event_record") {
          return eventMap.get(reference.id) ?? null;
        }

        return stopMap.get(reference.id) ?? null;
      })
      .filter((item): item is ChatAttachment => Boolean(item))
      .filter((item) => {
        const key = `${item.source}:${item.id}`;
        if (dedupKeys.has(key)) {
          return false;
        }

        dedupKeys.add(key);
        return true;
      });

    const { data: assistantRow, error: insertAssistantError } = await supabase
      .from("map_ai_messages")
      .insert({
        conversation_id: conversationId,
        role: "assistant",
        content: aiOutput.answer,
        attachments,
      })
      .select("id, role, content, attachments, created_at")
      .single();

    if (insertAssistantError || !assistantRow) {
      return NextResponse.json(
        { error: "Không thể lưu phản hồi AI." },
        { status: 500 },
      );
    }

    const conversations = await loadConversations(user.id);

    return NextResponse.json(
      {
        conversationId,
        assistantMessage: toApiMessage(assistantRow as MessageRow),
        conversations,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Đã có lỗi xảy ra khi tạo phản hồi AI.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
