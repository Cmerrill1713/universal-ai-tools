export interface PortConfig {
    mainServer: number;
    lfm2Server: number;
    lmStudio: number;
    ollama: number;
    dspyOrchestrator: number;
    mlxBridge: number;
    mlxProvider: number;
    pyVisionBridge: number;
    redis: number;
    prometheus: number;
    grafana: number;
    frontend: number;
    storybook: number;
    postgres: number;
    supabaseStudio: number;
}
export declare function autoConfigurePorts(): Promise<PortConfig>;
export declare function getServiceUrls(ports: PortConfig): {
    mainServer: string;
    lfm2Server: string;
    lmStudio: string;
    ollama: string;
    dspyOrchestrator: string;
    mlxBridge: string;
    mlxProvider: string;
    pyVisionBridge: string;
    redis: string;
    prometheus: string;
    grafana: string;
    frontend: string;
    storybook: string;
    postgres: string;
    supabaseStudio: string;
};
export declare function logPortConfiguration(ports: PortConfig): void;
export declare function getPorts(): Promise<PortConfig>;
export declare const ports: PortConfig;
//# sourceMappingURL=ports.d.ts.map