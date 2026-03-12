import * as React from "react";

import {
  File04,
  FileCode02,
  FileX02,
  Image01,
  Tablet01,
} from "@untitledui/icons";

type FileIconProps = {
  extension: string;
  className?: string;
};

export function getFileKind(extension: string) {
  const ext = extension.toLowerCase();

  if (["pdf"].includes(ext)) return "pdf";
  if (["doc", "docx", "txt", "md"].includes(ext)) return "text";
  if (["xls", "xlsx", "csv"].includes(ext)) return "spreadsheet";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
  if (["json", "js", "jsx", "ts", "tsx", "html", "css", "sql", "xml"].includes(ext)) return "code";

  return "default";
}

export function FileTypeIcon({
  extension,
  className = "h-5 w-5",
}: FileIconProps) {
  const kind = getFileKind(extension);

  switch (kind) {
    case "pdf":
      return <FileX02 className={className} />;
    case "text":
      return <File04 className={className} />;
    case "spreadsheet":
      return <Tablet01 className={className} />;
    case "image":
      return <Image01 className={className} />;
    case "code":
      return <FileCode02 className={className} />;
    default:
      return <File04 className={className} />;
  }
}