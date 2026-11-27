import { configRead } from './config';
import { addResponseFilter } from './hooks/json-parse';
import type { VideoQualityData } from './player_api/yt-api';

const VP09_CODEC = 'vp09';
const AV1_CODEC = 'av01';
const VP9_FORMAT_IDS = new Set([
  '278',
  '242',
  '243',
  '244',
  '247',
  '248',
  '271',
  '302',
  '303',
  '308',
  '313',
  '315',
  '330',
  '331',
  '332',
  '333',
  '334',
  '335',
  '336',
  '337'
]);

interface StreamingFormat {
  mimeType?: string;
}

interface StreamingData {
  formats?: StreamingFormat[];
  adaptiveFormats?: StreamingFormat[];
}

interface PlayerResponse {
  streamingData?: StreamingData;
}

function isAv1MimeType(mimeType: string | undefined) {
  return mimeType?.includes(AV1_CODEC) ?? false;
}

function isVp09MimeType(mimeType: string | undefined) {
  return mimeType?.includes(VP09_CODEC) ?? false;
}

export function getPreferredVp9FormatId(qualityData: VideoQualityData[]) {
  return qualityData.find(
    (format) =>
      format.isPlayable &&
      format.formatId !== undefined &&
      VP9_FORMAT_IDS.has(format.formatId)
  )?.formatId;
}

function isVideoFormat(format: StreamingFormat) {
  return format.mimeType?.startsWith('video/') ?? false;
}

function filterFormats(formats: StreamingFormat[] | undefined) {
  if (!formats) return 0;

  const hasVp09Video = formats.some(
    (format) => isVideoFormat(format) && isVp09MimeType(format.mimeType)
  );
  if (!hasVp09Video) return 0;

  const originalLength = formats.length;
  formats.splice(
    0,
    formats.length,
    ...formats.filter(
      (format) => !isVideoFormat(format) || isVp09MimeType(format.mimeType)
    )
  );

  return originalLength - formats.length;
}

addResponseFilter('video-codec', (response) => {
  if (!configRead('forceVp9Codec')) return;

  const streamingData = (response as PlayerResponse).streamingData;
  if (!streamingData) return;

  const removedFormats = filterFormats(streamingData.formats);
  const removedAdaptiveFormats = filterFormats(streamingData.adaptiveFormats);
  const removedTotal = removedFormats + removedAdaptiveFormats;

  if (removedTotal > 0) {
    console.info(
      `[video-codec] Filtered ${removedTotal} non-VP09 video formats`
    );
  }
});

const originalCanPlayType = HTMLMediaElement.prototype.canPlayType;
HTMLMediaElement.prototype.canPlayType = function (mimeType) {
  if (configRead('forceVp9Codec')) {
    if (isAv1MimeType(mimeType)) return '';
    if (isVp09MimeType(mimeType)) return 'probably';
  }

  return originalCanPlayType.call(this, mimeType);
};

const originalIsTypeSupported = window.MediaSource?.isTypeSupported;
if (originalIsTypeSupported) {
  window.MediaSource.isTypeSupported = function (mimeType) {
    if (configRead('forceVp9Codec')) {
      if (isAv1MimeType(mimeType)) return false;
      if (isVp09MimeType(mimeType)) return true;
    }

    return originalIsTypeSupported.call(this, mimeType);
  };
}

const originalDecodingInfo = navigator.mediaCapabilities?.decodingInfo;
if (originalDecodingInfo) {
  navigator.mediaCapabilities.decodingInfo = function (configuration) {
    const mimeType = configuration.video?.contentType;
    if (configRead('forceVp9Codec') && isAv1MimeType(mimeType)) {
      return Promise.resolve({
        supported: false,
        smooth: false,
        powerEfficient: false,
        keySystemAccess: null
      });
    }

    return originalDecodingInfo.call(this, configuration);
  };
}
