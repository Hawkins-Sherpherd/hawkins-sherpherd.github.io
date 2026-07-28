// ── Location constants ─────────────────────────────────────
const loc_hkg = [22.2793278, 114.1628131];
const loc_sjc = [37.335480, -121.893028];
const loc_buf = [42.8864, -78.8784];
const loc_fra = [50.1106444, 8.6820917];
const loc_tyo = [35.6821936, 139.762221];
const loc_can = [23.129764, 113.263197];
const loc_ctu = [30.659462, 104.065735];
const loc_sin = [1.283333, 103.833333];
const loc_het = [40.8421, 111.7503];
const loc_wds = [32.6295, 110.7983];
// const loc_cgk = [-6.18, 106.83];
const loc_dfw = [32.7792, -96.8089];
const loc_azj = [32.188, 119.428];
const loc_lhr = [51.5072, -0.1275];

// ── Leaflet colored marker icons (from pointhi/leaflet-color-markers) ──
const _markerIconBase = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/';
const _markerShadow = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';

function createColoredIcon(color) {
    return new L.Icon({
        iconUrl: _markerIconBase + 'marker-icon-' + color + '.png',
        shadowUrl: _markerShadow,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
}

const redIcon    = createColoredIcon('red');
const blueIcon   = createColoredIcon('blue');
const greenIcon  = createColoredIcon('green');
const orangeIcon = createColoredIcon('orange');
const yellowIcon = createColoredIcon('yellow');
const violetIcon = createColoredIcon('violet');
const greyIcon   = createColoredIcon('grey');
const blackIcon  = createColoredIcon('black');

// ── Node definitions ───────────────────────────────────────
const nodeDefs = [
    { id: 'hkg', lat: loc_hkg[0], lng: loc_hkg[1], popup: "<b>DN42:</b> hkg1.sherpherd.dn42<br><b>Clearnet:</b> hkg1.sherpherd.net<br><b>Location:</b> Hong Kong, China<br><b>Bandwidth:</b> 1Gbps<br><br><b>MPLS Enabled</b><br>" },
    { id: 'sjc', lat: loc_sjc[0], lng: loc_sjc[1], popup: "<b>DN42:</b> sjc1.sherpherd.dn42<br><b>Clearnet:</b> sjc1.sherpherd.net<br><b>Location:</b> San Jose, CA, United States<br><b>Bandwidth:</b> 10Gbps<br><br><b>MPLS Enabled</b><br><hr><b>DN42:</b> scix-us.sherpherd.dn42<br><b>Clearnet:</b> scix-us.sherpherd.net<br><b>Location:</b> San Jose, CA, United States<br><b>Bandwidth:</b> 1Gbps<br><br><b>SCIX Node</b>, encouraged to peer through SCIX LAN" },
    { id: 'fra', lat: loc_fra[0], lng: loc_fra[1], popup: "<b>DN42:</b> fra1.sherpherd.dn42<br><b>Clearnet:</b> fra1.sherpherd.net<br><b>Location:</b> Frankfurt, Germany<br><b>Bandwidth:</b> 10Gbps<br><br><b>MPLS Enabled</b><br><hr><b>DN42:</b> yukisino-ix-de.sherpherd.dn42<br><b>Clearnet:</b> N/A<br><b>Location:</b> Frankfurt, Germany<br><b>Bandwidth:</b> 1Gbps<br>" },
    { id: 'buf', lat: loc_buf[0], lng: loc_buf[1], popup: "<b>DN42:</b> buf1.sherpherd.dn42<br><b>Clearnet:</b> buf1.sherpherd.net<br><b>Location:</b> Buffalo, NY, United States<br><b>Bandwidth:</b> 1Gbps<br><br><b>MPLS Enabled</b><br>" },
    { id: 'dfw', lat: loc_dfw[0], lng: loc_dfw[1], popup: "<b>DN42:</b> dfw1.sherpherd.dn42<br><b>Clearnet:</b> dfw1.sherpherd.net<br><b>Location:</b> Dallas, TX, United States<br><b>Bandwidth:</b> 1Gbps<br><br><b>MPLS Enabled</b><br>" },
    { id: 'can', lat: loc_can[0], lng: loc_can[1], popup: "<b>DN42:</b> can1.sherpherd.dn42<br><b>Clearnet:</b> can1.sherpherd.net<br><b>Location:</b> Guangzhou, Guangdong, China<br><b>Bandwidth:</b> 200Mbps<br><br><b>MPLS Enabled</b><br>" },
    { id: 'ctu', lat: loc_ctu[0], lng: loc_ctu[1], popup: "<b>DN42:</b> ctu1.sherpherd.dn42<br><b>Clearnet:</b> ctu1.sherpherd.net<br><b>Location:</b> Chengdu, Sichuan, China<br><b>Bandwidth:</b> 3Mbps<br><br><b>MPLS Enabled</b><br>" },
    { id: 'tyo', lat: loc_tyo[0], lng: loc_tyo[1], popup: "<b>DN42:</b> tyo1.sherpherd.dn42<br><b>Clearnet:</b> tyo1.sherpherd.net<br><b>Location:</b> Tokyo, Japan<br><b>Bandwidth:</b> 2.5Gbps<br><br><b>MPLS Enabled</b><br>" },
    { id: 'sin', lat: loc_sin[0], lng: loc_sin[1], popup: "<b>DN42:</b> sin1.sherpherd.dn42<br><b>Clearnet:</b> sin1.sherpherd.net<br><b>Location:</b> Singapore<br><b>Bandwidth:</b> 5Gbps<br><br><b>MPLS Enabled</b><br>" },
    { id: 'wds', lat: loc_wds[0], lng: loc_wds[1], popup: "<b>DN42:</b> wds1.sherpherd.dn42<br><b>Clearnet:</b> wds1.sherpherd.net<br><b>Location:</b> Shiyan, Hubei, China<br><b>Bandwidth:</b> 15Mbps<br><br><b>MPLS Enabled</b><br>" },
//    { id: 'cgk', lat: loc_cgk[0], lng: loc_cgk[1], popup: "<b>DN42:</b> cgk1.sherpherd.dn42<br><b>Clearnet:</b> cgk1.sherpherd.net<br><b>Location:</b> Jakarta, Indonesia<br><b>Bandwidth:</b> 200Mbps<br><br>" },
    { id: 'azj', lat: loc_azj[0], lng: loc_azj[1], popup: "<b>DN42:</b> azj1.sherpherd.dn42<br><b>Clearnet:</b> azj1.sherpherd.net<br><b>Location:</b> Zhenjiang, Jiangsu, China<br><b>Bandwidth:</b> 30Mbps<br><br><b>MPLS Enabled</b><br>" },
    { id: 'lhr', lat: loc_lhr[0], lng: loc_lhr[1], popup: "<b>DN42:</b> lhr1.sherpherd.dn42<br><b>Clearnet:</b> lhr1.sherpherd.net<br><b>Location:</b> London, United Kingdom<br><b>Bandwidth:</b> 1Gbps<br><br><b>MPLS Enabled</b><br>" }
];

function nodeById(id) { return nodeDefs.find(function(n) { return n.id === id; }); }

// ── Link definitions (from→to, auto shortest geodesic arc) ─
var linkDefs = [
    { from: 'sjc', to: 'buf', style: {opacity: 0.8}, popup: "<b>Link Name: </b>SJC1 == BUF1<br><b>Estimated RTT Latency:</b> 56ms" },
    { from: 'buf', to: 'fra', style: {opacity: 0.8}, popup: "<b>Link Name: </b>BUF1 == FRA1<br><b>Estimated RTT Latency:</b> 130ms" },
    { from: 'can', to: 'tyo', style: {opacity: 0.8}, popup: "<b>Link Name: </b>CAN1 == TYO1<br><b>Estimated RTT Latency:</b> 180ms" },
    { from: 'can', to: 'hkg', style: {opacity: 0.8}, popup: "<b>Link Name: </b>CAN1 == HKG1<br><b>Estimated RTT Latency:</b> 80ms<hr><b>Link Name: </b>CAN1 == HKG3<br><b>Estimated RTT Latency:</b> 40ms" },
    { from: 'sjc', to: 'hkg', style: {opacity: 0.8}, popup: "<b>Link Name: </b>SJC1 == HKG1<br><b>Estimated RTT Latency:</b> 160ms<hr><b>Link Name: </b>SJC1 == HKG2<br><b>Estimated RTT Latency:</b> 150ms" },
    { from: 'sjc', to: 'tyo', style: {opacity: 0.8}, popup: "<b>Link Name: </b>SJC1 == TYO1<br><b>Estimated RTT Latency:</b> 105ms" },
    { from: 'hkg', to: 'fra', style: {opacity: 0.8}, popup: "<b>Link Name: </b>HKG1 == FRA1<br><b>Estimated RTT Latency:</b> 190ms<hr><b>Link Name: </b>HKG2 == FRA1<br><b>Estimated RTT Latency:</b> 180ms" },
    { from: 'can', to: 'sjc', style: {opacity: 0.8}, popup: "<b>Link Name: </b>CAN1 == SJC1<br><b>Estimated RTT Latency:</b> 180ms" },
    { from: 'hkg', to: 'tyo', style: {opacity: 0.8}, popup: "<b>Link Name: </b>HKG1 == TYO1<br><b>Estimated RTT Latency:</b> 50ms<hr><b>Link Name: </b>HKG2 == TYO1<br><b>Estimated RTT Latency:</b> 50ms<hr><b>Link Name: </b>HKG3 == TYO1<br><b>Estimated RTT Latency:</b> 50ms" },
    { from: 'can', to: 'fra', style: {opacity: 0.8}, popup: "<b>Link Name: </b>CAN1 == FRA1<br><b>Estimated RTT Latency:</b> 200ms" },
    { from: 'ctu', to: 'can', style: {opacity: 0.8}, popup: "<b>Link Name: </b>CTU1 == CAN1<br><b>Estimated RTT Latency:</b> 40ms" },
    { from: 'sin', to: 'hkg', style: {opacity: 0.8}, popup: "<b>Link Name: </b>SIN1 == HKG1<br><b>Estimated RTT Latency:</b> 40ms<hr><b>Link Name: </b>SIN1 == HKG3<br><b>Estimated RTT Latency:</b> 40ms" },
    { from: 'sin', to: 'tyo', style: {opacity: 0.8}, popup: "<b>Link Name: </b>SIN1 == TYO1<br><b>Estimated RTT Latency:</b> 90ms" },
    { from: 'sin', to: 'sjc', style: {opacity: 0.8}, popup: "<b>Link Name: </b>SIN1 == SJC1<br><b>Estimated RTT Latency:</b> 190ms" },
    { from: 'wds', to: 'can', style: {opacity: 0.8}, popup: "<b>Link Name: </b>WDS1 == CAN1<br><b>Estimated RTT Latency:</b> 60ms" },
    { from: 'ctu', to: 'wds', style: {opacity: 0.8}, popup: "<b>Link Name: </b>CTU1 == WDS1<br><b>Estimated RTT Latency:</b> 50ms" },
    { from: 'sjc', to: 'dfw', style: {opacity: 0.8}, popup: "<b>Link Name: </b>SJC1 == DFW1<br><b>Estimated RTT Latency:</b> 55ms" },
    { from: 'dfw', to: 'buf', style: {opacity: 0.8}, popup: "<b>Link Name: </b>DFW1 == BUF1<br><b>Estimated RTT Latency:</b> 90ms" },
//    { from: 'sin', to: 'cgk', style: {opacity: 0.8}, popup: "<b>Link Name: </b>SIN1 == CGK1<br><b>Estimated RTT Latency:</b> 15ms" },
    { from: 'wds', to: 'azj', style: {opacity: 0.8}, popup: "<b>Link Name: </b>WDS1 == AZJ1<br><b>Estimated RTT Latency:</b> 40ms" },
    { from: 'ctu', to: 'azj', style: {opacity: 0.8}, popup: "<b>Link Name: </b>CTU1 == AZJ1<br><b>Estimated RTT Latency:</b> 50ms" },
    { from: 'can', to: 'azj', style: {opacity: 0.8}, popup: "<b>Link Name: </b>CAN1 == AZJ1<br><b>Estimated RTT Latency:</b> 35ms" },
    { from: 'azj', to: 'tyo', style: {opacity: 0.8}, popup: "<b>Link Name: </b>AZJ1 == TYO1<br><b>Estimated RTT Latency:</b> 75ms" },
    { from: 'azj', to: 'sjc', style: {opacity: 0.8}, popup: "<b>Link Name: </b>AZJ1 == SJC1<br><b>Estimated RTT Latency:</b> 160ms" },
    { from: 'azj', to: 'fra', style: {opacity: 0.8}, popup: "<b>Link Name: </b>AZJ1 == FRA1<br><b>Estimated RTT Latency:</b> 200ms" },
    { from: 'sin', to: 'fra', style: {opacity: 0.8}, popup: "<b>Link Name: </b>SIN1 == FRA1<br><b>Estimated RTT Latency:</b> 150ms" },
    { from: 'lhr', to: 'fra', style: {opacity: 0.8}, popup: "<b>Link Name: </b>LHR1 == FRA1<br><b>Estimated RTT Latency:</b> 20ms" },
    { from: 'lhr', to: 'hkg', style: {opacity: 0.8}, popup: "<b>Link Name: </b>LHR1 == HKG1<br><b>Estimated RTT Latency:</b> 180ms" },
    { from: 'lhr', to: 'sin', style: {opacity: 0.8}, popup: "<b>Link Name: </b>LHR1 == SIN1<br><b>Estimated RTT Latency:</b> 150ms" },
    { from: 'lhr', to: 'buf', style: {opacity: 0.8}, popup: "<b>Link Name: </b>LHR1 == BUF1<br><b>Estimated RTT Latency:</b> 90ms" }
];
