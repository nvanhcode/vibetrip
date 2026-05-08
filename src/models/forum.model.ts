export type ForumPost = {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar_url: string | null;
  content: string;
  image_urls: string[];
  checkin_place_id: string | null;
  checkin_place_name: string | null;
  checkin_place_address: string | null;
  checkin_latitude: number | null;
  checkin_longitude: number | null;
  event_record_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ForumPostLike = {
  post_id: string;
  user_id: string;
  created_at: string;
};

export type ForumPostComment = {
  id: string;
  post_id: string;
  parent_comment_id: string | null;
  author_id: string;
  author_name: string;
  author_avatar_url: string | null;
  content: string;
  created_at: string;
  updated_at: string;
};
