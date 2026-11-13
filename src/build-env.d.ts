interface ImportMeta {
  readonly env: {
    readonly DEV?: boolean;
  };
}

declare const process: {
  readonly env: Record<string, string | undefined>;
};

declare const __STK_RELEASE_ID__: string;
declare const __STK_NEARBY_ENABLED__: boolean;
