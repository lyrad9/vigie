"use client";

import MuxPlayer from "@mux/mux-player-react/lazy";
import { site } from "@/lib/site";
import { videoTokens } from "@/lib/video-tokens";

/**
 * The presentation video, in the same white product frame the screenshots used: an outer frame
 * with a hairline edge and a soft drop shadow, the player inset with its own radius.
 */
export function HeroVideo() {
  return (
    <figure className="settle mx-auto max-w-[68rem] rounded-[30px] border border-hairline bg-card p-2.5 shadow-[0_1px_2px_oklch(0.2_0.02_262/0.06),0_30px_70px_-30px_oklch(0.2_0.02_262/0.35)] sm:p-3.5">
      <div className="overflow-hidden rounded-[20px] bg-band ring-1 ring-black/5 sm:rounded-[22px]">
        <MuxPlayer
          loading="viewport"
          playbackId={site.video.playbackId}
          tokens={videoTokens}
          streamType="on-demand"
          accentColor="#3b82f6"
          primaryColor="#ffffff"
          thumbnailTime={site.video.posterTime}
          metadata={{ video_title: site.video.title }}
          title={site.video.title}
          className="block aspect-video w-full [--media-object-fit:cover]"
          style={{ aspectRatio: "16 / 9" }}
        />
      </div>
      <figcaption className="sr-only">{site.video.title}</figcaption>
    </figure>
  );
}
