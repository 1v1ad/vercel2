declare global {
  interface Window {
    VK: {
      init: (config: { apiId: number }) => void;
      Auth: {
        login: (callback: (response: any) => void, scope?: number) => void;
      };
    };
  }
}

export {};