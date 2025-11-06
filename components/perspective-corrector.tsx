"use client";

import type React from "react";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShisaDownload, ShisaFolderPlus, ShisaRotate } from "shisa-icon";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { FileInput } from "./ui/file-input";

interface Point {
  x: number;
  y: number;
}

interface Corners {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

export default function PerspectiveCorrector() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [corners, setCorners] = useState<Corners | null>(null);
  const [draggingCorner, setDraggingCorner] = useState<keyof Corners | null>(
    null
  );
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [outputFormat, setOutputFormat] = useState<"png" | "jpeg" | "webp">(
    "png"
  );
  const [outputQuality, setOutputQuality] = useState<number>(95);
  const [isPreparing, setIsPreparing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const srcImageDataRef = useRef<ImageData | null>(null);
  const previewImageDataRef = useRef<ImageData | null>(null);

  // Corner visual radius and padding so handles don't get clipped at edges
  const CORNER_RADIUS = 10; // keep this in sync with drawing radius
  const PAD = CORNER_RADIUS + 12; // extra safe margin

  useEffect(() => {
    if (image && canvasRef.current) {
      const maxWidth = 800;
      const maxHeight = 600;

      let width = image.width;
      let height = image.height;

      // Scale down if too large
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = width * ratio;
        height = height * ratio;
      }

      // Defer state updates to avoid synchronous setState in the effect body
      let raf = 0;
      raf = requestAnimationFrame(() => {
        setCanvasSize({ width, height });

        // Set initial corners at image corners (logical coords without padding)
        setCorners({
          topLeft: { x: 0, y: 0 },
          topRight: { x: width, y: 0 },
          bottomRight: { x: width, y: height },
          bottomLeft: { x: 0, y: height },
        });
      });

      return () => {
        cancelAnimationFrame(raf);
      };
    }
  }, [image]);

  // Cache full-resolution image pixel data once when the image loads.
  useEffect(() => {
    if (!image) {
      srcImageDataRef.current = null;
      tempCanvasRef.current = null;
      return;
    }

    // create an offscreen/temp canvas once and cache its ImageData
    const c = document.createElement("canvas");
    c.width = image.width;
    c.height = image.height;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    try {
      srcImageDataRef.current = ctx.getImageData(
        0,
        0,
        image.width,
        image.height
      );
      tempCanvasRef.current = c;
    } catch {
      // getImageData may fail on cross-origin images; fall back to null
      // leave srcImageDataRef.current as null and the preview will skip
      srcImageDataRef.current = null;
      tempCanvasRef.current = null;
    }

    return () => {
      // allow GC
      srcImageDataRef.current = null;
      tempCanvasRef.current = null;
    };
  }, [image]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // keep file state in sync with this upload handler
    setFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // When the dnd FileInput sets a `file`, load it into the editor just like the
  // file input handler. This keeps a single image-loading path.
  useEffect(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => setImage(img);
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [file]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !image || !corners) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    // Make internal canvas include padding so corner handles never get clipped.
    const internalLogicalWidth = canvasSize.width + 2 * PAD;
    const internalLogicalHeight = canvasSize.height + 2 * PAD;

    canvas.width = internalLogicalWidth * dpr;
    canvas.height = internalLogicalHeight * dpr;
    // Make the editor canvas responsive: let it scale down on small viewports
    // while keeping a max width equal to the logical internal canvas size so internal
    // coordinate math (which uses canvasSize) remains correct.
    canvas.style.width = "100%";
    canvas.style.maxWidth = `${internalLogicalWidth}px`;
    canvas.style.height = "auto";

    // Reset transform and scale for DPR
    ctx.setTransform(1, 0, 0, 1, 0, 0); // clear any previous transforms
    ctx.scale(dpr, dpr);

    // Translate origin by padding so all drawing uses (0..canvasSize.width, 0..height)
    ctx.translate(PAD, PAD);

    // Enable crisp rendering for the interactive canvas
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(-PAD, -PAD, internalLogicalWidth, internalLogicalHeight);

    // Draw image scaled to canvas (inside padded region)
    ctx.drawImage(image, 0, 0, canvasSize.width, canvasSize.height);

    // Draw polygon overlay
    ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(corners.topLeft.x, corners.topLeft.y);
    ctx.lineTo(corners.topRight.x, corners.topRight.y);
    ctx.lineTo(corners.bottomRight.x, corners.bottomRight.y);
    ctx.lineTo(corners.bottomLeft.x, corners.bottomLeft.y);
    ctx.closePath();
    ctx.stroke();

    const cornerKeys: (keyof Corners)[] = [
      "topLeft",
      "topRight",
      "bottomRight",
      "bottomLeft",
    ];
    cornerKeys.forEach((key) => {
      const corner = corners[key];

      // Outer circle (white)
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, CORNER_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Inner circle (blue)
      ctx.fillStyle = "rgb(59, 130, 246)";
      ctx.beginPath();
      ctx.arc(
        corner.x,
        corner.y,
        Math.round(CORNER_RADIUS * 0.7),
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Border
      ctx.strokeStyle = "rgb(37, 99, 235)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, CORNER_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
    });
  };

  useEffect(() => {
    if (image && corners && canvasRef.current) {
      drawCanvas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, corners]);

  const getPerspectiveTransform = (src: number[], dst: number[]) => {
    // Compute perspective transformation matrix h such that dst = H * src (in homogeneous coords)
    const A: number[][] = [];
    const b: number[] = [];

    for (let i = 0; i < 4; i++) {
      const sx = src[i * 2];
      const sy = src[i * 2 + 1];
      const dx = dst[i * 2];
      const dy = dst[i * 2 + 1];

      A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
      b.push(dx);
      A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
      b.push(dy);
    }

    // Solve using Gaussian elimination
    const h = gaussianElimination(A, b);
    h.push(1);

    return h; // length 9
  };

  const gaussianElimination = (A: number[][], b: number[]): number[] => {
    const n = A.length;
    // make a deep copy to avoid mutating input
    const M = A.map((row) => row.slice());
    const B = b.slice();

    for (let i = 0; i < n; i++) {
      // find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
          maxRow = k;
        }
      }
      [M[i], M[maxRow]] = [M[maxRow], M[i]];
      [B[i], B[maxRow]] = [B[maxRow], B[i]];

      // guard against singular matrix
      if (Math.abs(M[i][i]) < 1e-12) {
        // return identity-ish fallback (shouldn't happen for valid quad)
        return [1, 0, 0, 0, 1, 0, 0, 0];
      }

      for (let k = i + 1; k < n; k++) {
        const factor = M[k][i] / M[i][i];
        for (let j = i; j < M[i].length; j++) {
          M[k][j] -= factor * M[i][j];
        }
        B[k] -= factor * B[i];
      }
    }

    const x: number[] = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = B[i];
      for (let j = i + 1; j < n; j++) {
        sum -= M[i][j] * x[j];
      }
      x[i] = sum / M[i][i];
    }

    return x;
  };

  // Render preview on demand (when user opens the popover). We don't run live updates.
  const renderPreview = () => {
    if (!image || !corners || !previewCanvasRef.current) return;

    const srcImageData = srcImageDataRef.current;
    if (!srcImageData) return; // can't preview without pixel buffer

    const sW = srcImageData.width;
    const sH = srcImageData.height;
    const srcData = srcImageData.data;

    const scaleX = image.width / canvasSize.width;
    const scaleY = image.height / canvasSize.height;

    const sx0 = corners.topLeft.x * scaleX;
    const sy0 = corners.topLeft.y * scaleY;
    const sx1 = corners.topRight.x * scaleX;
    const sy1 = corners.topRight.y * scaleY;
    const sx2 = corners.bottomRight.x * scaleX;
    const sy2 = corners.bottomRight.y * scaleY;
    const sx3 = corners.bottomLeft.x * scaleX;
    const sy3 = corners.bottomLeft.y * scaleY;

    const topEdge = Math.hypot(sx1 - sx0, sy1 - sy0);
    const bottomEdge = Math.hypot(sx2 - sx3, sy2 - sy3);
    const leftEdge = Math.hypot(sx3 - sx0, sy3 - sy0);
    const rightEdge = Math.hypot(sx2 - sx1, sy2 - sy1);

    const widthF = (topEdge + bottomEdge) / 2;
    const heightF = (leftEdge + rightEdge) / 2;

    const previewMaxWidth = 320;
    const previewWidth = Math.max(
      1,
      Math.min(previewMaxWidth, Math.round(widthF))
    );
    const previewHeight = Math.max(
      1,
      Math.round((heightF / widthF) * previewWidth)
    );

    const previewCanvas = previewCanvasRef.current!;

    // Supersample factor for slightly higher quality preview (SSAA)
    const ssaa = 2; // 2x supersample gives noticeably sharper downscaled result

    const internalW = previewWidth * ssaa;
    const internalH = previewHeight * ssaa;

    // Create an internal offscreen canvas at higher resolution
    const internalCanvas = document.createElement("canvas");
    internalCanvas.width = internalW;
    internalCanvas.height = internalH;
    const internalCtx = internalCanvas.getContext("2d");
    if (!internalCtx) return;

    const dstCorners = [0, 0, internalW, 0, internalW, internalH, 0, internalH];
    const srcCorners = [sx0, sy0, sx1, sy1, sx2, sy2, sx3, sy3];

    const transform = getPerspectiveTransform(dstCorners, srcCorners);

    const h0 = transform[0],
      h1 = transform[1],
      h2 = transform[2];
    const h3 = transform[3],
      h4 = transform[4],
      h5 = transform[5];
    const h6 = transform[6],
      h7 = transform[7],
      h8 = transform[8];

    // reuse ImageData buffer for internal canvas if possible
    let imageData = previewImageDataRef.current;
    if (
      !imageData ||
      imageData.width !== internalW ||
      imageData.height !== internalH
    ) {
      imageData = internalCtx.createImageData(internalW, internalH);
      previewImageDataRef.current = imageData;
    }
    const data = imageData.data;

    // local vars for speed
    const pW = internalW;
    const pH = internalH;
    const srcW = sW;

    for (let yy = 0; yy < pH; yy++) {
      for (let xx = 0; xx < pW; xx++) {
        const idxDst = (yy * pW + xx) * 4;

        const w = h6 * xx + h7 * yy + h8;
        if (Math.abs(w) < 1e-8) {
          data[idxDst] = 0;
          data[idxDst + 1] = 0;
          data[idxDst + 2] = 0;
          data[idxDst + 3] = 0;
          continue;
        }

        const srcX = (h0 * xx + h1 * yy + h2) / w;
        const srcY = (h3 * xx + h4 * yy + h5) / w;

        if (srcX >= 0 && srcX < srcW - 1 && srcY >= 0 && srcY < sH - 1) {
          const x0 = srcX | 0;
          const y0 = srcY | 0;
          const x1 = x0 + 1;
          const y1 = y0 + 1;
          const dx = srcX - x0;
          const dy = srcY - y0;

          const row0 = y0 * srcW;
          const row1 = y1 * srcW;

          for (let c = 0; c < 4; c++) {
            const v00 = srcData[(row0 + x0) * 4 + c];
            const v10 = srcData[(row0 + x1) * 4 + c];
            const v01 = srcData[(row1 + x0) * 4 + c];
            const v11 = srcData[(row1 + x1) * 4 + c];

            const v0 = v00 * (1 - dx) + v10 * dx;
            const v1 = v01 * (1 - dx) + v11 * dx;
            data[idxDst + c] = (v0 * (1 - dy) + v1 * dy) | 0;
          }
        } else {
          data[idxDst] = 0;
          data[idxDst + 1] = 0;
          data[idxDst + 2] = 0;
          data[idxDst + 3] = 0;
        }
      }
    }

    // Paint internal high-res image into internal canvas
    internalCtx.putImageData(imageData, 0, 0);

    // Now draw the internal canvas downscaled into the visible preview canvas
    previewCanvas.width = previewWidth;
    previewCanvas.height = previewHeight;
    previewCanvas.style.width = `${previewWidth}px`;
    previewCanvas.style.height = `${previewHeight}px`;

    const ctx = previewCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, previewWidth, previewHeight);
    ctx.imageSmoothingEnabled = true;
    // assign with an augmented type so linter/TS don't complain across different TS lib configs
    const cs = ctx as CanvasRenderingContext2D & {
      imageSmoothingQuality?: ImageSmoothingQuality | string;
    };
    cs.imageSmoothingQuality = "high";
    ctx.drawImage(
      internalCanvas,
      0,
      0,
      internalW,
      internalH,
      0,
      0,
      previewWidth,
      previewHeight
    );
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!corners) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    // Map screen px to logical canvas units (which include padding), then subtract PAD
    const logicalTotalWidth = canvasSize.width + 2 * PAD;
    const logicalTotalHeight = canvasSize.height + 2 * PAD;
    const logicalXTotal =
      (e.clientX - rect.left) * (logicalTotalWidth / rect.width);
    const logicalYTotal =
      (e.clientY - rect.top) * (logicalTotalHeight / rect.height);

    const x = logicalXTotal - PAD;
    const y = logicalYTotal - PAD;

    const cornerKeys: (keyof Corners)[] = [
      "topLeft",
      "topRight",
      "bottomRight",
      "bottomLeft",
    ];
    for (const key of cornerKeys) {
      const corner = corners[key];
      const distance = Math.hypot(x - corner.x, y - corner.y);
      if (distance < Math.max(20, CORNER_RADIUS * 1.8)) {
        setDraggingCorner(key);
        e.preventDefault();
        break;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggingCorner || !corners) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const logicalTotalWidth = canvasSize.width + 2 * PAD;
    const logicalTotalHeight = canvasSize.height + 2 * PAD;
    const logicalXTotal =
      (e.clientX - rect.left) * (logicalTotalWidth / rect.width);
    const logicalYTotal =
      (e.clientY - rect.top) * (logicalTotalHeight / rect.height);

    let x = logicalXTotal - PAD;
    let y = logicalYTotal - PAD;

    // Clamp to image logical area
    x = Math.max(0, Math.min(canvasSize.width, x));
    y = Math.max(0, Math.min(canvasSize.height, y));

    setCorners({
      ...corners,
      [draggingCorner]: { x, y },
    });
  };

  const handleMouseUp = () => {
    setDraggingCorner(null);
  };

  const handleReset = () => {
    if (!image) return;

    setCorners({
      topLeft: { x: 0, y: 0 },
      topRight: { x: canvasSize.width, y: 0 },
      bottomRight: { x: canvasSize.width, y: canvasSize.height },
      bottomLeft: { x: 0, y: canvasSize.height },
    });
  };

  const handleDownload = async () => {
    if (!image || !corners) return;
    // let UI show loading state before heavy sync work
    setIsPreparing(true);
    await new Promise((res) => requestAnimationFrame(() => res(undefined)));

    try {
      // Scale corners back to original image resolution

      const scaleX = image.width / canvasSize.width;
      const scaleY = image.height / canvasSize.height;

      const scaledCorners = {
        topLeft: {
          x: corners.topLeft.x * scaleX,
          y: corners.topLeft.y * scaleY,
        },
        topRight: {
          x: corners.topRight.x * scaleX,
          y: corners.topRight.y * scaleY,
        },
        bottomRight: {
          x: corners.bottomRight.x * scaleX,
          y: corners.bottomRight.y * scaleY,
        },
        bottomLeft: {
          x: corners.bottomLeft.x * scaleX,
          y: corners.bottomLeft.y * scaleY,
        },
      };

      const topEdge = Math.hypot(
        scaledCorners.topRight.x - scaledCorners.topLeft.x,
        scaledCorners.topRight.y - scaledCorners.topLeft.y
      );
      const bottomEdge = Math.hypot(
        scaledCorners.bottomRight.x - scaledCorners.bottomLeft.x,
        scaledCorners.bottomRight.y - scaledCorners.bottomLeft.y
      );
      const leftEdge = Math.hypot(
        scaledCorners.bottomLeft.x - scaledCorners.topLeft.x,
        scaledCorners.bottomLeft.y - scaledCorners.topLeft.y
      );
      const rightEdge = Math.hypot(
        scaledCorners.bottomRight.x - scaledCorners.topRight.x,
        scaledCorners.bottomRight.y - scaledCorners.topRight.y
      );

      // Use average of opposite edges for more balanced output
      const widthF = (topEdge + bottomEdge) / 2;
      const heightF = (leftEdge + rightEdge) / 2;

      // Round to integer pixels
      const width = Math.max(1, Math.round(widthF));
      const height = Math.max(1, Math.round(heightF));

      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = width;
      outputCanvas.height = height;
      const ctx = outputCanvas.getContext("2d");
      if (!ctx) return;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Source corners (original image coordinates)
      const srcCorners = [
        scaledCorners.topLeft.x,
        scaledCorners.topLeft.y,
        scaledCorners.topRight.x,
        scaledCorners.topRight.y,
        scaledCorners.bottomRight.x,
        scaledCorners.bottomRight.y,
        scaledCorners.bottomLeft.x,
        scaledCorners.bottomLeft.y,
      ];

      // Destination corners (rectangle we want to fill)
      const dstCorners = [0, 0, width, 0, width, height, 0, height];

      // IMPORTANT FIX:
      // getPerspectiveTransform(src, dst) returns H such that dst = H * src.
      // For rasterizing destination pixels we need mapping dst -> src, so compute
      // the transform that maps the destination rectangle back to source by swapping.
      const transform = getPerspectiveTransform(dstCorners, srcCorners); // now maps dst -> src

      // Prepare a temporary canvas containing the full source image pixels for sampling
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = image.width;
      tempCanvas.height = image.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return;

      tempCtx.drawImage(image, 0, 0);
      const srcImageData = tempCtx.getImageData(
        0,
        0,
        image.width,
        image.height
      );
      const srcData = srcImageData.data;

      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;

      // transform is 9 elements (h0..h8) mapping destination (x,y) to source (srcX,srcY) in homogeneous coords
      // srcX = (h0*x + h1*y + h2) / (h6*x + h7*y + h8)
      // srcY = (h3*x + h4*y + h5) / (h6*x + h7*y + h8)
      for (let yy = 0; yy < height; yy++) {
        for (let xx = 0; xx < width; xx++) {
          const idxDst = (yy * width + xx) * 4;

          const w = transform[6] * xx + transform[7] * yy + transform[8];
          if (Math.abs(w) < 1e-8) {
            // avoid division by zero
            data[idxDst + 0] = 0;
            data[idxDst + 1] = 0;
            data[idxDst + 2] = 0;
            data[idxDst + 3] = 0;
            continue;
          }

          const srcX =
            (transform[0] * xx + transform[1] * yy + transform[2]) / w;
          const srcY =
            (transform[3] * xx + transform[4] * yy + transform[5]) / w;

          // Bilinear sampling if inside source bounds
          if (
            srcX >= 0 &&
            srcX < image.width - 1 &&
            srcY >= 0 &&
            srcY < image.height - 1
          ) {
            const x0 = Math.floor(srcX);
            const y0 = Math.floor(srcY);
            const x1 = x0 + 1;
            const y1 = y0 + 1;
            const dx = srcX - x0;
            const dy = srcY - y0;

            for (let c = 0; c < 4; c++) {
              const v00 = srcData[(y0 * image.width + x0) * 4 + c];
              const v10 = srcData[(y0 * image.width + x1) * 4 + c];
              const v01 = srcData[(y1 * image.width + x0) * 4 + c];
              const v11 = srcData[(y1 * image.width + x1) * 4 + c];

              const v0 = v00 * (1 - dx) + v10 * dx;
              const v1 = v01 * (1 - dx) + v11 * dx;
              data[idxDst + c] = Math.round(v0 * (1 - dy) + v1 * dy);
            }
          } else {
            // outside source — set transparent
            data[idxDst + 0] = 0;
            data[idxDst + 1] = 0;
            data[idxDst + 2] = 0;
            data[idxDst + 3] = 0;
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);

      const mimeType = `image/${outputFormat}`;
      const quality = outputFormat === "png" ? undefined : outputQuality / 100;

      const link = document.createElement("a");
      const extension = outputFormat === "jpeg" ? "jpg" : outputFormat;
      link.download = `corrected-image.${extension}`;
      link.href = outputCanvas.toDataURL(mimeType, quality);
      link.click();
    } finally {
      // ensure the loading state is cleared even if something throws
      setIsPreparing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col px-3 pb-3">
      {image ? (
        <Card className="w-full h-full flex-1 flex flex-col">
          <CardHeader className="w-full flex gap-3 items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                size="sm"
              >
                <ShisaFolderPlus />
                Upload New
              </Button>
              <Button onClick={handleReset} variant="outline" size="sm">
                <ShisaRotate />
                Reset Corners
              </Button>
            </div>
            <div className="flex items-center gap-1.5">
              <Popover
                onOpenChange={(open: boolean) => {
                  if (open) requestAnimationFrame(() => renderPreview());
                }}
              >
                <PopoverTrigger asChild>
                  <Button size="sm">Download</Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="space-y-3">
                  <canvas
                    ref={previewCanvasRef}
                    className="border border-border rounded shadow-lg"
                    style={{ width: 320, height: 240 }}
                  />
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground text-right flex-1">
                      Format
                    </span>
                    <Select
                      value={outputFormat}
                      onValueChange={(value: "png" | "jpeg" | "webp") =>
                        setOutputFormat(value)
                      }
                    >
                      <SelectTrigger className="w-[200px]" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="end">
                        <SelectItem value="png">PNG</SelectItem>
                        <SelectItem value="jpeg">JPEG</SelectItem>
                        <SelectItem value="webp">WebP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(outputFormat === "jpeg" || outputFormat === "webp") && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground text-right flex-1">
                        Quality
                      </span>
                      <Select
                        value={outputQuality.toString()}
                        onValueChange={(value) =>
                          setOutputQuality(Number(value))
                        }
                      >
                        <SelectTrigger className="w-[200px]" size="sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                          <SelectItem value="100">100% (Best)</SelectItem>
                          <SelectItem value="95">95% (High)</SelectItem>
                          <SelectItem value="90">90%</SelectItem>
                          <SelectItem value="85">85%</SelectItem>
                          <SelectItem value="80">80%</SelectItem>
                          <SelectItem value="75">75%</SelectItem>
                          <SelectItem value="70">70%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button
                    onClick={handleDownload}
                    size="sm"
                    className="w-full"
                    disabled={isPreparing}
                  >
                    {isPreparing ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                          />
                        </svg>
                        Preparing...
                      </>
                    ) : (
                      <>
                        <ShisaDownload />
                        Download Image
                      </>
                    )}
                  </Button>
                </PopoverContent>
              </Popover>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/tiff,image/svg+xml,image/heic,image/heif"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-full flex-1">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="max-w-full cursor-crosshair border border-border rounded shadow-lg"
              style={{
                touchAction: "none",
                width: "100%",
                // include padding in the maxWidth so the displayed canvas matches the internal logical width
                maxWidth: canvasSize.width
                  ? `${canvasSize.width + 2 * PAD}px`
                  : undefined,
                height: "auto",
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full h-full flex-1 p-3 flex">
          <FileInput name="image-upload" file={file} setFile={setFile} />
        </Card>
      )}
      {/* Global preparing overlay so user sees progress even if popover closes */}
      {isPreparing && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/40"
        >
          <div className="bg-popover text-popover-foreground rounded-md p-4 flex items-center gap-3 shadow-lg">
            <svg
              className="animate-spin -ml-1 mr-2 h-5 w-5 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            <div>
              <div className="font-medium">Preparing download…</div>
              <div className="text-sm text-muted-foreground">
                This may take a few seconds for large images.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
