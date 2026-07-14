'use client'

import Image from 'next/image'

function Placeholder({ name }: { name: string }) {
  const ch = (name || '?').charAt(0)
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-4xl font-bold text-white">
      {ch}
    </div>
  )
}

export function PosItemCard({
  name,
  description,
  priceLabel,
  imageUrl,
  onClick,
}: {
  name: string
  description?: string
  priceLabel: string
  imageUrl?: string | null
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-card text-left shadow-md transition active:scale-[0.98] hover:shadow-xl"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover transition duration-300 group-hover:scale-105"
            sizes="(max-width:768px) 50vw, 25vw"
            unoptimized
          />
        ) : (
          <Placeholder name={name} />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8">
          <p className="text-lg font-bold text-white drop-shadow">{priceLabel}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 font-semibold leading-snug">{name}</p>
        {description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </button>
  )
}
