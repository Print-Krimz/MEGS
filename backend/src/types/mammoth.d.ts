declare module "mammoth" {
  export function extractRawText(options: { buffer: Buffer } | { path: string }): Promise<{ value: string; messages: any[] }>;
  const mammoth: {
    extractRawText(options: { buffer: Buffer } | { path: string }): Promise<{ value: string; messages: any[] }>;
  };
  export default mammoth;
}
