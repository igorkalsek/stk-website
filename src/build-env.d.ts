interface ImportMeta {
  readonly env: {
    readonly DEV?: boolean;
  };
}

declare const process: {
  readonly env: Record<string, string | undefined>;
};
