export interface Notice {
  kind: string;
  text: string;
}

export interface LauncherProcess {
  parentId: number;
  args: string[];
}
