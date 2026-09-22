export class OpenIdVerificationError extends Error {}
export class PrivateProfileError extends Error {}
export class VanityNotFoundError extends Error {}
export class InvalidProfileUrlError extends Error {}
export class ProfileNotFoundError extends Error {}

export interface OwnedGame {
  appid: number;
  name: string;
  playtime_forever: number;      // dakika
  playtime_2weeks?: number;
  rtime_last_played?: number;    // unix saniye
}

export interface GameMeta {
  appid: number;
  name: string;
  tags: Map<string, number>;     // 0..1 normalize
  genres: string[];
  releaseDate: string;           // ISO yyyy-mm-dd
  reviewCount: number;
  positiveRatio: number;
  owners: number;
}

export type TagVector = Map<string, number>;
