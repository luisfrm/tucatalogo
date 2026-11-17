import { describe, expect, it } from "vitest";

import {
  IMAGE_INPUT_MAX_BYTES,
  ImageNormalizationError,
  computeCoverCrop,
  computeFitSize,
  formatBytes,
  validateSourceImage,
} from "../app/lib/image-normalize";

describe("validación del archivo de entrada", () => {
  it("acepta JPG, PNG y WebP de hasta 2 MB", () => {
    expect(validateSourceImage({ size: 1024, type: "image/jpeg" })).toBeNull();
    expect(validateSourceImage({ size: 1024, type: "image/png" })).toBeNull();
    expect(validateSourceImage({ size: IMAGE_INPUT_MAX_BYTES, type: "image/webp" })).toBeNull();
  });

  it("rechaza formatos ajenos, archivos vacíos y más de 2 MB", () => {
    expect(validateSourceImage({ size: 10, type: "image/gif" })).toContain("Formato");
    expect(validateSourceImage({ size: 10, type: "application/pdf" })).toContain("Formato");
    expect(validateSourceImage({ size: 0, type: "image/jpeg" })).toContain("vacío");
    expect(validateSourceImage({ size: IMAGE_INPUT_MAX_BYTES + 1, type: "image/png" })).toContain("2 MB");
  });
});

describe("dimensiones de producto", () => {
  it("escala al ancho máximo conservando proporción", () => {
    expect(computeFitSize(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 });
    expect(computeFitSize(3200, 1600, 600)).toEqual({ width: 600, height: 300 });
    expect(computeFitSize(1200, 900, 1600)).toEqual({ width: 1200, height: 900 });
  });

  it("no amplía imágenes pequeñas", () => {
    expect(computeFitSize(400, 300, 1600)).toEqual({ width: 400, height: 300 });
    expect(computeFitSize(400, 300, 600)).toEqual({ width: 400, height: 300 });
  });

  it("falla con dimensiones inválidas", () => {
    expect(() => computeFitSize(0, 10, 1600)).toThrow(ImageNormalizationError);
    expect(() => computeFitSize(10, 10, 0)).toThrow(ImageNormalizationError);
    expect(() => computeFitSize(Number.NaN, 10, 1600)).toThrow(ImageNormalizationError);
  });
});

describe("recorte del hero", () => {
  it("recorta los lados en una imagen más ancha que el destino", () => {
    // 2000×1000 → 1600×900: sobra ancho.
    expect(computeCoverCrop(2000, 1000, 1600, 900)).toEqual({
      sx: 111,
      sy: 0,
      sw: 1778,
      sh: 1000,
    });
  });

  it("recorta arriba y abajo en una imagen más alta que el destino", () => {
    // 1000×2000 → 900×1200: sobra alto.
    expect(computeCoverCrop(1000, 2000, 900, 1200)).toEqual({
      sx: 0,
      sy: 334,
      sw: 1000,
      sh: 1333,
    });
  });

  it("no recorta si la proporción ya coincide", () => {
    expect(computeCoverCrop(1600, 900, 1600, 900)).toEqual({
      sx: 0,
      sy: 0,
      sw: 1600,
      sh: 900,
    });
  });

  it("falla con dimensiones no válidas", () => {
    expect(() => computeCoverCrop(0, 100, 1600, 900)).toThrow(ImageNormalizationError);
    expect(() => computeCoverCrop(100, 100, 0, 900)).toThrow(ImageNormalizationError);
  });
});

describe("tamaño legible", () => {
  it("formatea bytes, KB y MB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});
