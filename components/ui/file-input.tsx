"use client";
import { cn } from "@/lib/utils";
import React, { useState, useRef, Fragment } from "react";
import { Button } from "./button";
import { ShisaFolder } from "shisa-icon";

function FileInput({
  name,
  setFile,
}: {
  name: string;
  file: File | null;
  setFile: React.Dispatch<React.SetStateAction<File | null>>;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <Fragment>
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);

          const [droppedFile] = e.dataTransfer.files;
          setFile(droppedFile);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        className={cn(
          "border border-zinc-300 dark:border-zinc-700  rounded p-12 text-center transition-all w-full flex-1 flex items-center justify-center",
          isDragging
            ? "border bg-primary/5 scale-[1.01]"
            : "border-dashed hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50"
        )}
      >
        <div className="flex flex-col items-center gap-4">
          <ShisaFolder />
          <div className="space-y-2">
            <p className="text-lg font-medium">
              Drop your image here or click to browse
            </p>
          </div>

          <div>
            <Button
              size="sm"
              className="cursor-pointer"
              type="button"
              variant="outline"
            >
              Select Image
            </Button>
          </div>
        </div>
      </div>

      <input
        id="image-upload"
        name={name}
        ref={inputRef}
        type="file"
        onChange={(e) => {
          const selectedFile = e.target.files?.[0];
          if (selectedFile) setFile(selectedFile);
        }}
        className="sr-only"
      />
    </Fragment>
  );
}

export { FileInput };
