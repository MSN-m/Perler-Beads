import { detectPixelArtFeatures } from '../processor.js?v=20261116-preview-first';

self.onmessage = ({ data: imageData }) => {
    self.postMessage(detectPixelArtFeatures(imageData));
};
