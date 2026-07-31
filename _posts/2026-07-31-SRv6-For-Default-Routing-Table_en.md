---
layout: post_dn42
title: "SRv6 for Default Routing Table"
---
In previous [post](/2026/07/30/DN42-Over-SRv6-L3VPN-Deployment_en.html), I have wrote how did I deploy DN42 over SRv3 L3VPN on my infrastructure, but haven't mention a more popular scenario: SRv6 for traffic looking up default routing table, not everyone want to mess with VRF (it's a trouble for service deployment and eBGP peering either). 

This article is about how to configure SRv6 for default routing table, with help of Containerlab for demostration.

The Containerlab lab can be found [here](https://github.com/Hawkins-Sherpherd/srv6-lab1).

# Why SRv6
- With SRv6 as second dataplane, the transit traffic can forward on intermediate nodes without BGP running. Once BGP process failed, the node can still forward internal transit traffic, prevents BGP blackhole.
- Multiservice support (L3VPN, traffic engineering, L2 transport, etc.).
- Support on most Linux server you can buy (including LXC containers), no extra kernel modules required.

# 1 Topology
All router in this topology runs FRR.

![Topology](/img/srv6-lab.clab.png)

# 2 Create Network Interface
A VRF interface is needed for END.DT4 action route install for default routing table, or the route will be rejected. Use a VRF bind to table 254 for workaround.

IS-IS need a dummy interface for SRv6 Locator route, by default, it's sr0.

All command followed are **NOT** persistent, the way to persist configuration is on yours.
```
ip link add sr0 type dummy
ip link set sr0 up mtu 65536
ip link add name vrf-main type vrf table 254
ip link set vrf-main up
```

# 3 Kernel Parameter Adjustment
All command followed are **NOT** persistent, the way to persist configuration is on yours.

Don't forget to enable SRv6 for every interface transmits SRv6 traffic.
```
sysctl -w net.ipv6.seg6_flowlabel=1
sysctl -w net.ipv6.conf.all.seg6_enabled=1
sysctl -w net.ipv6.conf.eth1.seg6_enabled=1
sysctl -w net.ipv6.conf.lo.seg6_enabled=1
sysctl -w net.ipv6.conf.all.forwarding=1
sysctl -w net.ipv4.ip_forward=1
sysctl -w net.vrf.strict_mode=1
```
**Caution: **net.vrf.strict_mode is a critical parameter, it determines whether different VRF can share one routing table or not, when its value equals 1, every VRF has to have dedicate routing table. If it's value not equal to 1, the SRv6 IPv4 L3VPN won't work, the related SID routes will be rejected.

net.vrf.strict_mode resets 0 everytime a new VRF adds, to prevent network operation interrupt, please create all VRF could be used at most.

# 4 BGP SRv6 for Default Routing Table
No VRF configuration involved in FRR, all happens in default scope.

Skip the deamons, SRv6 Locator and IS-IS configuration as they already shown in previous [post](/2026/07/30/DN42-Over-SRv6-L3VPN-Deployment_en.html).

Send SRv6 encapsulation information in Unicast families, and use "sid export" instead "sid vpn export".

This is BGP Unicast families configuration on R1:
```
 address-family ipv4 unicast
  network 203.0.113.0/24
  neighbor 2001:db8::2 encapsulation-srv6
  sid export auto
 exit-address-family
 !
 address-family ipv6 unicast
  network 2001:db8:1::/64
  neighbor 2001:db8::2 activate
  neighbor 2001:db8::2 encapsulation-srv6
  sid export auto
 exit-address-family
```

# 5 Complete Configurations
R1:
```
frr version 10.7.0_git
frr defaults traditional
hostname r1
!
ip router-id 1.1.1.1
!
interface eth1
 ipv6 router isis 1
 isis network point-to-point
exit
!
interface eth2
 ip address 203.0.113.1/24
 ipv6 address 2001:db8:1::1/64
exit
!
interface lo
 ipv6 address 2001:db8::1/128
 ipv6 address 5f00:1:1::1/64
 ipv6 router isis 1
exit
!
router bgp 1
 neighbor 2001:db8::2 remote-as 1
 neighbor 2001:db8::2 update-source lo
 neighbor 2001:db8::2 capability extended-nexthop
 !
 segment-routing srv6
  locator MAIN
 exit
 !
 address-family ipv4 unicast
  network 203.0.113.0/24
  neighbor 2001:db8::2 encapsulation-srv6
  sid export auto
 exit-address-family
 !
 address-family ipv6 unicast
  network 2001:db8:1::/64
  neighbor 2001:db8::2 activate
  neighbor 2001:db8::2 encapsulation-srv6
  sid export auto
 exit-address-family
exit
!
router isis 1
 is-type level-1
 net 00.0010.0100.1001.00
 segment-routing srv6
  locator MAIN
 exit
exit
!
segment-routing
 srv6
  encapsulation
   source-address 5f00:1:1::1
  exit
  locators
   locator MAIN
    prefix 5f00:1:1::/48
    behavior usid
    format usid-f3216
   exit
   !
  exit
  !
 exit
 !
exit
!
```

R3:
```
frr version 10.7.0_git
frr defaults traditional
hostname r3
!
ip router-id 1.1.1.2
!
interface eth1
 ipv6 router isis 1
 isis network point-to-point
exit
!
interface eth2
 ip address 192.0.2.1/24
 ipv6 address 2001:db8:2::1/64
exit
!
interface lo
 ipv6 address 2001:db8::2/128
 ipv6 address 5f00:1:2::1/128
 ipv6 router isis 1
exit
!
router bgp 1
 neighbor 2001:db8::1 remote-as 1
 neighbor 2001:db8::1 update-source lo
 neighbor 2001:db8::1 capability extended-nexthop
 !
 segment-routing srv6
  locator MAIN
 exit
 !
 address-family ipv4 unicast
  network 192.0.2.0/24
  neighbor 2001:db8::1 encapsulation-srv6
  sid export auto
 exit-address-family
 !
 address-family ipv6 unicast
  network 2001:db8:2::/64
  neighbor 2001:db8::1 activate
  neighbor 2001:db8::1 encapsulation-srv6
  sid export auto
 exit-address-family
exit
!
router isis 1
 is-type level-1
 net 00.0010.0100.2001.00
 segment-routing srv6
  locator MAIN
 exit
exit
!
segment-routing
 srv6
  encapsulation
   source-address 5f00:1:2::1
  exit
  locators
   locator MAIN
    prefix 5f00:1:2::/48
    behavior usid
    format usid-f3216
   exit
   !
  exit
  !
 exit
 !
exit
!
```

# 6 Verfication
# 6.1 Check routing table of R1, R2 and R3:
R1:
```
r1# show ip route
Codes: K - kernel route, C - connected, L - local, S - static,
       R - RIP, O - OSPF, I - IS-IS, B - BGP, E - EIGRP, N - NHRP,
       T - Table, v - VNC, V - VNC-Direct, A - Babel, F - PBR,
       f - OpenFabric, t - Table-Direct,
       > - selected route, * - FIB route, q - queued, r - rejected, b - backup
       t - trapped, o - offload failure

IPv4 unicast VRF default:
K>* 0.0.0.0/0 [0/0] via 172.20.20.1, eth0 (vrf default), weight 1, 01:34:55
C>* 172.20.20.0/24 is directly connected, eth0 (vrf default), weight 1, 01:34:55
L>* 172.20.20.3/32 is directly connected, eth0 (vrf default), weight 1, 01:34:55
B>  192.0.2.0/24 [200/0] via 2001:db8::2 (recursive), seg6 5f00:1:2:e000::, weight 1, 01:19:14
  *                        via fe80::a8c1:abff:fecc:41b2, eth1, seg6 5f00:1:2:e000::, weight 1, 01:19:14
C>* 203.0.113.0/24 is directly connected, eth2, weight 1, 01:20:06
L>* 203.0.113.1/32 is directly connected, eth2, weight 1, 01:20:06
r1# show ipv6 route
Codes: K - kernel route, C - connected, L - local, S - static,
       R - RIPng, O - OSPFv3, I - IS-IS, B - BGP, N - NHRP,
       T - Table, v - VNC, V - VNC-Direct, A - Babel, F - PBR,
       f - OpenFabric, t - Table-Direct,
       > - selected route, * - FIB route, q - queued, r - rejected, b - backup
       t - trapped, o - offload failure

IPv6 unicast VRF default:
K>* ::/0 [0/1024] via 3fff:172:20:20::1, eth0 (vrf default), weight 1, 01:34:57
L * 2001:db8::1/128 is directly connected, lo (vrf default), weight 1, 01:34:56
C>* 2001:db8::1/128 is directly connected, lo (vrf default), weight 1, 01:34:56
I>* 2001:db8::2/128 [115/30] via fe80::a8c1:abff:fecc:41b2, eth1, weight 1, 01:19:35
I>* 2001:db8::ffff/128 [115/20] via fe80::a8c1:abff:fecc:41b2, eth1, weight 1, 01:34:25
C>* 2001:db8:1::/64 is directly connected, eth2, weight 1, 01:20:08
L>* 2001:db8:1::1/128 is directly connected, eth2, weight 1, 01:20:08
B>  2001:db8:2::/64 [200/0] via 2001:db8::2 (recursive), seg6 5f00:1:2:e001::, weight 1, 01:19:16
  *                           via fe80::a8c1:abff:fecc:41b2, eth1, seg6 5f00:1:2:e001::, weight 1, 01:19:16
C>* 3fff:172:20:20::/64 is directly connected, eth0 (vrf default), weight 1, 01:34:57
L>* 3fff:172:20:20::3/128 is directly connected, eth0 (vrf default), weight 1, 01:34:57
I>* 5f00:1:1::/48 [115/0] is directly connected, sr0 (vrf default), seg6local uN, weight 1, 01:34:54
C>* 5f00:1:1::/64 is directly connected, lo (vrf default), weight 1, 01:34:56
L>* 5f00:1:1::1/128 is directly connected, lo (vrf default), weight 1, 01:34:56
I>* 5f00:1:1:e000::/64 [115/0] is directly connected, eth1, seg6local uA nh6 fe80::a8c1:abff:fecc:41b2, eth1, weight 1, 01:34:53
B>* 5f00:1:1:e001::/128 [20/0] is directly connected, sr0, seg6local uDT4 table 254, weight 1, 01:34:48
B>* 5f00:1:1:e002::/128 [20/0] is directly connected, sr0, seg6local uDT6 table 254, weight 1, 01:34:48
I>* 5f00:1:2::/48 [115/20] via fe80::a8c1:abff:fecc:41b2, eth1, weight 1, 01:19:35
I>* 5f00:1:2::1/128 [115/30] via fe80::a8c1:abff:fecc:41b2, eth1, weight 1, 01:19:35
I>* 5f00:1:ffff::/48 [115/10] via fe80::a8c1:abff:fecc:41b2, eth1, weight 1, 01:34:25
I>* 5f00:1:ffff::1/128 [115/20] via fe80::a8c1:abff:fecc:41b2, eth1, weight 1, 01:34:25
C * fe80::/64 is directly connected, eth2, weight 1, 01:20:08
C * fe80::/64 is directly connected, sr0 (vrf default), weight 1, 01:34:54
C * fe80::/64 is directly connected, eth1 (vrf default), weight 1, 01:34:54
C>* fe80::/64 is directly connected, eth0 (vrf default), weight 1, 01:34:56
```
R2:
```
r2# show ip route
Codes: K - kernel route, C - connected, L - local, S - static,
       R - RIP, O - OSPF, I - IS-IS, B - BGP, E - EIGRP, N - NHRP,
       T - Table, v - VNC, V - VNC-Direct, A - Babel, F - PBR,
       f - OpenFabric, t - Table-Direct,
       > - selected route, * - FIB route, q - queued, r - rejected, b - backup
       t - trapped, o - offload failure

IPv4 unicast VRF default:
K>* 0.0.0.0/0 [0/0] via 172.20.20.1, eth0, weight 1, 00:24:32
C>* 172.20.20.0/24 is directly connected, eth0, weight 1, 00:24:32
L>* 172.20.20.4/32 is directly connected, eth0, weight 1, 00:24:32
r2# show ipv6 route
Codes: K - kernel route, C - connected, L - local, S - static,
       R - RIPng, O - OSPFv3, I - IS-IS, B - BGP, N - NHRP,
       T - Table, v - VNC, V - VNC-Direct, A - Babel, F - PBR,
       f - OpenFabric, t - Table-Direct,
       > - selected route, * - FIB route, q - queued, r - rejected, b - backup
       t - trapped, o - offload failure

IPv6 unicast VRF default:
K>* ::/0 [0/1024] via 3fff:172:20:20::1, eth0, weight 1, 00:24:34
I>* 2001:db8::1/128 [115/20] via fe80::a8c1:abff:fe3b:1520, eth1, weight 1, 00:24:02
I>* 2001:db8::2/128 [115/20] via fe80::a8c1:abff:fe4a:6b7b, eth2, weight 1, 00:09:12
L * 2001:db8::ffff/128 is directly connected, lo, weight 1, 00:24:33
C>* 2001:db8::ffff/128 is directly connected, lo, weight 1, 00:24:33
C>* 3fff:172:20:20::/64 is directly connected, eth0, weight 1, 00:24:34
L>* 3fff:172:20:20::4/128 is directly connected, eth0, weight 1, 00:24:34
I>* 5f00:1:1::/48 [115/10] via fe80::a8c1:abff:fe3b:1520, eth1, weight 1, 00:24:02
I>* 5f00:1:1::/64 [115/20] via fe80::a8c1:abff:fe3b:1520, eth1, weight 1, 00:24:02
I>* 5f00:1:2::/48 [115/10] via fe80::a8c1:abff:fe4a:6b7b, eth2, weight 1, 00:09:12
I>* 5f00:1:2::1/128 [115/20] via fe80::a8c1:abff:fe4a:6b7b, eth2, weight 1, 00:09:12
I>* 5f00:1:ffff::/48 [115/0] is directly connected, sr0, seg6local uN, weight 1, 00:24:32
L * 5f00:1:ffff::1/128 is directly connected, lo, weight 1, 00:24:33
C>* 5f00:1:ffff::1/128 is directly connected, lo, weight 1, 00:24:33
I>* 5f00:1:ffff:e000::/64 [115/0] is directly connected, eth1, seg6local uA nh6 fe80::a8c1:abff:fe3b:1520, eth1, weight 1, 00:24:30
I>* 5f00:1:ffff:e001::/64 [115/0] is directly connected, eth2, seg6local uA nh6 fe80::a8c1:abff:fe4a:6b7b, eth2, weight 1, 00:09:40
C * fe80::/64 is directly connected, eth2, weight 1, 00:09:43
C * fe80::/64 is directly connected, eth1, weight 1, 00:24:31
C * fe80::/64 is directly connected, sr0, weight 1, 00:24:32
C>* fe80::/64 is directly connected, eth0, weight 1, 00:24:33
```
Since R2 don't run BGP, it don't receive BGP route goes to Client1 and Client2, only thing it forward is encapsulated SRv6 packets.

R3:
```
r3# show ip route
Codes: K - kernel route, C - connected, L - local, S - static,
       R - RIP, O - OSPF, I - IS-IS, B - BGP, E - EIGRP, N - NHRP,
       T - Table, v - VNC, V - VNC-Direct, A - Babel, F - PBR,
       f - OpenFabric, t - Table-Direct,
       > - selected route, * - FIB route, q - queued, r - rejected, b - backup
       t - trapped, o - offload failure

IPv4 unicast VRF default:
K>* 0.0.0.0/0 [0/0] via 172.20.20.1, eth0 (vrf default), weight 1, 00:02:36
C>* 172.20.20.0/24 is directly connected, eth0 (vrf default), weight 1, 00:02:36
L>* 172.20.20.2/32 is directly connected, eth0 (vrf default), weight 1, 00:02:36
C>* 192.0.2.0/24 is directly connected, eth2 (vrf default), weight 1, 00:02:34
L>* 192.0.2.1/32 is directly connected, eth2 (vrf default), weight 1, 00:02:34
B>  203.0.113.0/24 [200/0] via 2001:db8::1 (recursive), seg6 5f00:1:1:e001::, weight 1, 00:01:56
  *                          via fe80::a8c1:abff:fe28:ddd7, eth1, seg6 5f00:1:1:e001::, weight 1, 00:01:56
r3# show ipv6 route
Codes: K - kernel route, C - connected, L - local, S - static,
       R - RIPng, O - OSPFv3, I - IS-IS, B - BGP, N - NHRP,
       T - Table, v - VNC, V - VNC-Direct, A - Babel, F - PBR,
       f - OpenFabric, t - Table-Direct,
       > - selected route, * - FIB route, q - queued, r - rejected, b - backup
       t - trapped, o - offload failure

IPv6 unicast VRF default:
K>* ::/0 [0/1024] via 3fff:172:20:20::1, eth0 (vrf default), weight 1, 00:02:38
I>* 2001:db8::1/128 [115/30] via fe80::a8c1:abff:fe28:ddd7, eth1, weight 1, 00:02:05
L * 2001:db8::2/128 is directly connected, lo (vrf default), weight 1, 00:02:37
C>* 2001:db8::2/128 is directly connected, lo (vrf default), weight 1, 00:02:37
I>* 2001:db8::ffff/128 [115/20] via fe80::a8c1:abff:fe28:ddd7, eth1, weight 1, 00:02:08
B>  2001:db8:1::/64 [200/0] via 2001:db8::1 (recursive), seg6 5f00:1:1:e002::, weight 1, 00:01:58
  *                           via fe80::a8c1:abff:fe28:ddd7, eth1, seg6 5f00:1:1:e002::, weight 1, 00:01:58
C>* 2001:db8:2::/64 is directly connected, eth2 (vrf default), weight 1, 00:02:36
L>* 2001:db8:2::1/128 is directly connected, eth2 (vrf default), weight 1, 00:02:36
C>* 3fff:172:20:20::/64 is directly connected, eth0 (vrf default), weight 1, 00:02:38
L>* 3fff:172:20:20::2/128 is directly connected, eth0 (vrf default), weight 1, 00:02:38
I>* 5f00:1:1::/48 [115/20] via fe80::a8c1:abff:fe28:ddd7, eth1, weight 1, 00:02:05
I>* 5f00:1:1::/64 [115/30] via fe80::a8c1:abff:fe28:ddd7, eth1, weight 1, 00:02:05
I>* 5f00:1:2::/48 [115/0] is directly connected, sr0 (vrf default), seg6local uN, weight 1, 00:02:37
L * 5f00:1:2::1/128 is directly connected, lo (vrf default), weight 1, 00:02:37
C>* 5f00:1:2::1/128 is directly connected, lo (vrf default), weight 1, 00:02:37
I>* 5f00:1:2:e000::/64 [115/0] is directly connected, eth1, seg6local uA nh6 fe80::a8c1:abff:fe28:ddd7, eth1, weight 1, 00:02:33
B>* 5f00:1:2:e001::/128 [20/0] is directly connected, sr0, seg6local uDT4 table 254, weight 1, 00:02:29
B>* 5f00:1:2:e002::/128 [20/0] is directly connected, sr0, seg6local uDT6 table 254, weight 1, 00:02:29
I>* 5f00:1:ffff::/48 [115/10] via fe80::a8c1:abff:fe28:ddd7, eth1, weight 1, 00:02:05
I>* 5f00:1:ffff::1/128 [115/20] via fe80::a8c1:abff:fe28:ddd7, eth1, weight 1, 00:02:08
C * fe80::/64 is directly connected, eth2, weight 1, 00:02:35
C * fe80::/64 is directly connected, eth1, weight 1, 00:02:35
C * fe80::/64 is directly connected, sr0 (vrf default), weight 1, 00:02:37
C>* fe80::/64 is directly connected, eth0 (vrf default), weight 1, 00:02:38
```

# 6.2 Ping from Client1 and Client2
Client1:
```
/ # ping -c 4 192.0.2.2
PING 192.0.2.2 (192.0.2.2) 56(84) bytes of data.
64 bytes from 192.0.2.2: icmp_seq=1 ttl=63 time=0.299 ms
64 bytes from 192.0.2.2: icmp_seq=2 ttl=63 time=0.175 ms
64 bytes from 192.0.2.2: icmp_seq=3 ttl=63 time=0.158 ms
64 bytes from 192.0.2.2: icmp_seq=4 ttl=63 time=0.159 ms

--- 192.0.2.2 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3087ms
rtt min/avg/max/mdev = 0.158/0.197/0.299/0.058 ms
/ # ping -c 4 2001:db8:2::2
PING 2001:db8:2::2(2001:db8:2::2) 56 data bytes
64 bytes from 2001:db8:2::2: icmp_seq=1 ttl=63 time=0.235 ms
64 bytes from 2001:db8:2::2: icmp_seq=2 ttl=63 time=0.130 ms
64 bytes from 2001:db8:2::2: icmp_seq=3 ttl=63 time=0.127 ms
64 bytes from 2001:db8:2::2: icmp_seq=4 ttl=63 time=0.124 ms

--- 2001:db8:2::2 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3087ms
rtt min/avg/max/mdev = 0.124/0.154/0.235/0.046 ms
```
Client2:
```
/ # ping -c 4 203.0.113.2
PING 203.0.113.2 (203.0.113.2) 56(84) bytes of data.
64 bytes from 203.0.113.2: icmp_seq=1 ttl=63 time=0.172 ms
64 bytes from 203.0.113.2: icmp_seq=2 ttl=63 time=0.207 ms
64 bytes from 203.0.113.2: icmp_seq=3 ttl=63 time=0.163 ms
64 bytes from 203.0.113.2: icmp_seq=4 ttl=63 time=0.153 ms

--- 203.0.113.2 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3078ms
rtt min/avg/max/mdev = 0.153/0.173/0.207/0.020 ms
/ # ping -c 4 2001:db8:1::2
PING 2001:db8:1::2(2001:db8:1::2) 56 data bytes
64 bytes from 2001:db8:1::2: icmp_seq=1 ttl=63 time=0.117 ms
64 bytes from 2001:db8:1::2: icmp_seq=2 ttl=63 time=0.180 ms
64 bytes from 2001:db8:1::2: icmp_seq=3 ttl=63 time=0.137 ms
64 bytes from 2001:db8:1::2: icmp_seq=4 ttl=63 time=0.173 ms

--- 2001:db8:1::2 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3086ms
rtt min/avg/max/mdev = 0.117/0.151/0.180/0.025 ms
```

# 7 Known Limits
This section is copied from my previous [post](/2026/07/30/DN42-Over-SRv6-L3VPN-Deployment_en.html).

## 7.1 NAT
When destination route has SRv6 encapsulation, the traffic won't trigger SNAT rule in netfilter, instead, it encapsulates into SRv6 traffic directly then send out.

## 7.2 Router IPv6 address inaccessible
Due to unknown reason, the call path of SRv6 decapsulation is different for IPv4 and IPv6, the IPv4 return traffic can lookup destined VRF normally, while IPv6 don't. However, this don't affect transit traffic, only traffic sources or destined to the router is affected.
