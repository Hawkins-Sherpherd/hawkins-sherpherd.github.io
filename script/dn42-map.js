// ── Multi-world helpers for infinite horizontal scroll ─────
var renderedCopies = new Set(); // Track which copies are currently rendered
var markersByOffset = {}; // Store markers by offset for removal
var linksByOffset = {};   // Store links by offset for removal

function shiftPoints(pts, lngOffset) {
    return pts.map(function(p) { return [p[0], p[1] + lngOffset * 360]; });
}

function calculateRequiredCopies() {
    var bounds = map.getBounds();
    var west = bounds.getWest();
    var east = bounds.getEast();

    // Calculate which world copies are needed
    var required = new Set();
    var westCopy = Math.floor(west / 360);
    var eastCopy = Math.floor(east / 360);

    // Add copies within and adjacent to view
    for (var i = westCopy - 1; i <= eastCopy + 1; i++) {
        required.add(i);
    }
    return required;
}

function renderCopiesForView() {
    var required = calculateRequiredCopies();
    var toRemove = [];

    // Remove copies no longer needed
    renderedCopies.forEach(function(offset) {
        if (!required.has(offset)) {
            removeMarkers(offset);
            removeLinks(offset);
            toRemove.push(offset);
        }
    });
    toRemove.forEach(function(offset) { renderedCopies.delete(offset); });

    // Add new copies needed
    required.forEach(function(offset) {
        if (!renderedCopies.has(offset)) {
            addMarkers(offset);
            addLinks(offset);
            renderedCopies.add(offset);
        }
    });
}

function addMarkers(offset) {
    if (!markersByOffset[offset]) markersByOffset[offset] = [];
    nodeDefs.forEach(function(node) {
        var opts = node.icon ? { icon: node.icon } : {};
        var marker;
        if (offset === 0) {
            // Main marker
            marker = L.marker([node.lat, node.lng], opts).addTo(map)
                .bindPopup(node.popup).setZIndexOffset(1000);
        } else {
            // Ghost copy
            marker = L.marker([node.lat, node.lng + offset * 360],
                { icon: node.icon || new L.Icon.Default(), zIndexOffset: -100 }
            ).addTo(map).bindPopup(node.popup);
        }
        markersByOffset[offset].push(marker);
    });
}

function removeMarkers(offset) {
    if (markersByOffset[offset]) {
        markersByOffset[offset].forEach(function(marker) {
            map.removeLayer(marker);
        });
        delete markersByOffset[offset];
    }
}

function addLinks(offset) {
    if (!linksByOffset[offset]) linksByOffset[offset] = [];
    linkDefs.forEach(function(link) {
        var fromNode = nodeById(link.from);
        var toNode = nodeById(link.to);
        var pts = buildLinkPath(fromNode.lat, fromNode.lng, toNode.lat, toNode.lng);
        var shiftedPts = shiftPoints(pts, offset);
        var style = {};
        for (var k in link.style) { style[k] = link.style[k]; }
        style.noClip = true;
        linksByOffset[offset].push(L.polyline(shiftedPts, style).addTo(map).bindPopup(link.popup));
    });
}

function removeLinks(offset) {
    if (linksByOffset[offset]) {
        linksByOffset[offset].forEach(function(polyline) {
            map.removeLayer(polyline);
        });
        delete linksByOffset[offset];
    }
}

// ── Great-circle path (true spherical geodesic) ────────────
function toCartesian(lat, lng) {
    var latRad = lat * Math.PI / 180;
    var lngRad = lng * Math.PI / 180;
    var cosLat = Math.cos(latRad);
    return {
        x: cosLat * Math.cos(lngRad),
        y: cosLat * Math.sin(lngRad),
        z: Math.sin(latRad)
    };
}

function fromCartesian(v) {
    var lat = Math.asin(Math.max(-1, Math.min(1, v.z))) * 180 / Math.PI;
    var lng = Math.atan2(v.y, v.x) * 180 / Math.PI;
    return [lat, lng];
}

function buildLinkPath(fromLat, fromLng, toLat, toLng, steps) {
    steps = steps || 80;
    var a = toCartesian(fromLat, fromLng);
    var b = toCartesian(toLat, toLng);
    // Angle between vectors
    var dot = a.x * b.x + a.y * b.y + a.z * b.z;
    dot = Math.max(-1, Math.min(1, dot));
    var omega = Math.acos(dot);
    var points = [];
    if (omega < 0.0001) {
        points.push([fromLat, fromLng]);
        points.push([toLat, toLng]);
        return points;
    }
    var sinOmega = Math.sin(omega);
    for (var i = 0; i <= steps; i++) {
        var t = i / steps;
        var s = Math.sin((1 - t) * omega) / sinOmega;
        var t_ = Math.sin(t * omega) / sinOmega;
        var v = {
            x: s * a.x + t_ * b.x,
            y: s * a.y + t_ * b.y,
            z: s * a.z + t_ * b.z
        };
        points.push(fromCartesian(v));
    }
    // Unwrap longitudes so the path is continuous across ±180°
    var cumOffset = 0;
    var prevLng = points[0][1];
    for (var i = 1; i < points.length; i++) {
        var curLng = points[i][1];
        var diff = curLng - prevLng;
        if (diff > 180) cumOffset -= 360;
        else if (diff < -180) cumOffset += 360;
        prevLng = curLng;
        points[i][1] = curLng + cumOffset;
    }
    return points;
}

// ── Map initialization (no maxBounds for infinite pan) ─────
const map = new L.Map("map", {
    center: new L.LatLng(44.40726, 8.9338624),
    zoom: 2,
    maxZoom: 18,
    minZoom: 1
});

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Dynamically manage world copies based on view
map.on('moveend', renderCopiesForView);
map.on('zoomend', renderCopiesForView);

// Initial render of copies for current view
renderCopiesForView();
