// png.mjs 의 타입 선언. 도구와 테스트가 같은 코덱을 쓰되, 도구 자체는 tsc 없이
// Node 가 그대로 실행할 수 있어야 해서 .mjs 로 둔다.
export interface PngImage {
  width: number;
  height: number;
  rgb: Buffer;
}

export declare function decodePng(buffer: Buffer): PngImage;
export declare function encodePng(image: PngImage): Buffer;
export declare function pixelAt(image: PngImage, x: number, y: number): [number, number, number];
