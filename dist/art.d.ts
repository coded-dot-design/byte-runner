/** Owning pixel geometry for the game and generated website artwork. */
export interface PixelLayer {
    d: string;
    fill: string;
}
export interface PixelArt {
    viewBox: string;
    layers: PixelLayer[];
}
export declare const FROG: {
    readonly body: "#3ecb74";
    readonly edge: "#19774d";
    readonly power: "#8de45c";
    readonly powerEdge: "#438c40";
    readonly eye: "#fff5d7";
    readonly pupil: "#152820";
};
export declare const FLY_COLORS: readonly ["#8573ee", "#f4457a", "#06c4ff"];
export declare const FLY_EDGES: readonly ["#524486", "#973451", "#12677e"];
export declare const CREAM = "#fff5d7", WING = "#d9f0f3";
export type Facing = 0 | 1 | 2 | 3;
export declare const FROG_BODIES: {
    body: string;
    rim: string;
}[][];
export declare const FROG_EYES: {
    readonly side: {
        readonly stems: "M7 0h5v2h2v5H7V2H6V1h1ZM16 0h5v2h2v5h-7Z";
        readonly cream: "M9 1h5v2h-2v3h2v1H9V6H8V2h1ZM18 1h5v2h-2v3h2v1h-5V6h-1V2h1Z";
        readonly pupils: "M12 2h2v4h-2ZM21 2h2v4h-2Z";
    };
    readonly front: {
        readonly stems: "M5 0h5v1h1v7H4V2h1ZM15 0h5v2h1v6h-7V1h1Z";
        readonly cream: "M6 1h4v6H5V2h1ZM16 1h4v1h1v5h-6V2h1Z";
        readonly pupils: "M7 3h2v3H7ZM17 3h2v3h-2Z";
    };
};
export declare const FROG_FEET: readonly ["M4 20h4v2h1v2H2v-2h2ZM17 20h4v2h2v2h-7v-2h1Z", "M3 20h4v2h2v2H2v-1H1v-2h2ZM18 20h4v2h2v1h-6Z", "M4 20h4v2h2v1H3v-1h1ZM17 20h4v2h2v2h-7v-1h-1v-2h2Z", "M5 20h4v2h2v1H4v-1h1ZM16 20h4v2h1v2h-7v-2h2Z", "M3 20h4v2h2v1H2v-1h1ZM18 20h4v2h2v2h-7v-2h1Z"];
export declare const FLY_BODY = "M9 5h8v1h3v2h2v9h-1v2h-3v1h-2v-2h-3v2h-3v-2H7v-2H6v-5h1V8h2Z";
export declare const FLY_EYES = "M10 8h4v6h-4V13H9V9h1ZM17 8h4v1h1v5h-5Z";
export declare const FLY_PUPILS = "M12 9h2v4h-2ZM20 9h2v4h-2Z";
export declare const FLY_WINGS: readonly ["M2 0h2v2h2v2h1v5H5V7H3V5H1V2h1ZM21 1h2v2h1v2h1v4h-3V6h-2V3h1Z", "M0 7h3v1h2v2h2v3H4v-1H2v-1H0ZM23 7h2v1h2v3h-2v1h-3v1h-2v-3h1V9h2Z"];
export declare const FLY_FEET = "M9 18h3v3H9Zm7 0h3v3h-3Z";
export declare function frogArt(mouth?: number, power?: boolean): PixelArt;
export declare function flyArt(kind?: number, vulnerable?: boolean): PixelArt;
export declare const websiteSprites: {
    runner: PixelArt;
    "runner-overclock": PixelArt;
    "fly-chaser": PixelArt;
    "fly-interceptor": PixelArt;
    "fly-roamer": PixelArt;
    "fly-vulnerable": PixelArt;
};
