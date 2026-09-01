import app from "../server/_core/app";
import type { Request, Response } from "express";

export function restoreRewrittenApiPath(requestUrl: string) {
  const url = new URL(requestUrl, "https://healthair.local");
  const rewrittenPath = url.searchParams.get("path");
  if (!rewrittenPath) return requestUrl;

  url.searchParams.delete("path");
  const query = url.searchParams.toString();
  const normalizedPath = rewrittenPath.replace(/^\/+/, "");
  return `/api/${normalizedPath}${query ? `?${query}` : ""}`;
}

export default function handler(req: Request, res: Response) {
  req.url = restoreRewrittenApiPath(req.url);
  return app(req, res);
}
