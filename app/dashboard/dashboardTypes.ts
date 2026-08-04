export type CoupleProfile = {
  partner_one: string;
  partner_two: string;
  start_date: string;
  id: string;
  avatar?: string | null;
  avatar_one?: string | null;
  avatar_two?: string | null;
  status_one_text?: string | null;
  status_one_emoji?: string | null;
  status_two_text?: string | null;
  status_two_emoji?: string | null;
  status_updates_one?: number | null;
  status_updates_two?: number | null;
};

export type Couple = {
  id: string;
  partner_one_id: string;
  partner_two_id: string | null;
};
