'use client';

import { useResumeStore } from '@/store/useResumeStore';

export default function HeaderImageContent() {
  const { photo, setPhoto, activeLocale } = useResumeStore();
  const previewWidth = 40;
  const previewHeight = 40;
  const previewRadius = photo.borderRadius;
  const verticalPosition = photo.verticalPosition ?? "center";

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto({ url: reader.result as string });
    reader.readAsDataURL(file);
  }
  return (
    <div className="space-y-2">
      <label
        htmlFor="display-image-upload"
        className="inline-flex items-center justify-center rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-700 cursor-pointer"
      >
        {photo.url ? "Replace header image" : "Add header image"}
      </label>
      <input
        id="display-image-upload"
        type="file"
        accept="image/*"
        onChange={handlePhotoUpload}
        className="sr-only"
      />
      {photo.url && (
        <>
          <div className="flex items-center gap-2">
            <img
              src={photo.url}
              alt=""
              className="object-cover"
              style={{
                width: previewWidth,
                height: previewHeight,
                borderRadius: `${previewRadius}%`,
              }}
            />
            <button
              onClick={() => setPhoto({ url: "" })}
              className="text-xs text-red-600 hover:text-red-700 font-medium"
            >
              Remove
            </button>
          </div>
          <div>
            <label className="text-xs text-gray-500">
              Size: {photo.size}px
            </label>
            <input
              type="range"
              min={40}
              max={150}
              value={photo.size}
              onChange={(e) => setPhoto({ size: +e.target.value })}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">
              Roundness: {photo.borderRadius}% (Square to Circle)
            </label>
            <input
              type="range"
              min={0}
              max={50}
              value={photo.borderRadius}
              onChange={(e) => setPhoto({ borderRadius: +e.target.value })}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">
              Image/Introduction Space: {photo.contentGap ?? 14}px
            </label>
            <input
              type="range"
              min={0}
              max={120}
              value={photo.contentGap ?? 14}
              onChange={(e) => setPhoto({ contentGap: +e.target.value })}
              className="w-full"
            />
          </div>
        </>
      )}
    </div>
  );
}
