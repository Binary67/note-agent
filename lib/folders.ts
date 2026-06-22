export function normalizeFolderName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function folderNamesEqual(left: string, right: string): boolean {
  return normalizeFolderName(left).toLowerCase() === normalizeFolderName(right).toLowerCase();
}
