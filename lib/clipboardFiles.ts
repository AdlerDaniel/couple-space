type ClipboardFileItem = {
  kind: string;
  getAsFile: () => File | null;
};

type ClipboardFileSource = {
  items?: ArrayLike<ClipboardFileItem> | null;
  files?: ArrayLike<File> | null;
};

type ClipboardFilePasteEvent = {
  clipboardData: ClipboardFileSource;
  preventDefault: () => void;
};

export function getClipboardFiles(source: ClipboardFileSource) {
  const itemFiles = Array.from(source.items || []).flatMap((item) => {
    if (item.kind !== "file") return [];
    const file = item.getAsFile();
    return file ? [file] : [];
  });

  return itemFiles.length > 0 ? itemFiles : Array.from(source.files || []);
}

export function handleClipboardFilePaste(
  event: ClipboardFilePasteEvent,
  onFiles: (files: File[]) => void,
) {
  const files = getClipboardFiles(event.clipboardData);
  if (files.length === 0) return false;

  event.preventDefault();
  onFiles(files);
  return true;
}
