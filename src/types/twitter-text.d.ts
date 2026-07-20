declare module '@ambassify/twitter-text' {
  export interface ParsedTweet {
    weightedLength: number;
    permillage: number;
    valid: boolean;
    displayRangeStart: number;
    displayRangeEnd: number;
    validRangeStart: number;
    validRangeEnd: number;
  }

  export interface UrlEntity {
    url: string;
    display_url: string;
    expanded_url: string;
    indices: [number, number];
  }

  export interface AutoLinkOptions {
    urlEntities?: UrlEntity[];
  }

  export function parseTweet(text: string): ParsedTweet;
  export function extractMentions(text: string): string[];
  export function extractHashtags(text: string): string[];
  export function autoLink(text: string, options?: AutoLinkOptions): string;
  export function htmlEscape(text: string): string;
  export function getTweetLength(text: string): number;
}
