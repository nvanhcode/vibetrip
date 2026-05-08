export type RouteVisibility = "public" | "friends" | "private";

export type UserRouteStop = {
  id: string;
  route_id: string;
  position: number;
  stop_kind: "origin" | "record";
  label: string;
  latitude: number;
  longitude: number;
  event_record_id: string | null;
};

export type UserRoute = {
  id: string;
  owner_id: string;
  owner_display_name: string;
  title: string;
  start_date: string;
  visibility: RouteVisibility;
  origin_label: string;
  origin_latitude: number;
  origin_longitude: number;
  summary: string | null;
  stop_count: number;
  created_at: string;
  stops: UserRouteStop[];
};
