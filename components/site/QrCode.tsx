import QRCode from 'qrcode';

/**
 * A QR code for `text`, drawn as an SVG path on the server (no image file, no script). Each dark
 * module becomes a 1x1 square, with a four-module quiet zone around the code.
 */
export function QrCode({ text, label }: { text: string; label: string }) {
    const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const size = modules.size;
    let path = '';
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (modules.get(row, col)) path += `M${col + 4} ${row + 4}h1v1h-1z`;
        }
    }
    return (
        <svg className="qr" viewBox={`0 0 ${size + 8} ${size + 8}`} role="img" aria-label={label} shapeRendering="crispEdges">
            <rect width={size + 8} height={size + 8} fill="#ffffff" />
            <path d={path} fill="#0e2a21" />
        </svg>
    );
}
