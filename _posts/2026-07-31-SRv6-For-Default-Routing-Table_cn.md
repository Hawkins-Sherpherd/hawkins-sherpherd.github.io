---
layout: post_dn42
title: "为默认路由表配置 SRv6 "
---
在[上文](/2026/07/30/DN42-Over-SRv6-L3VPN-Deployment_cn.html)中，我讲述了我如何在我的基础设施之上部署 DN42 over SRv6 L3VPN，但还有一样更常见的场景是我未有提到的：为使用默认路由表中的流量配置 SRv6，毕竟不是每个人都想跟 VRF 打交道（服务部署和 eBGP peering 会因此变得麻烦）。

本文描述如何为默认路由表配置 SRv6，使用 Containerlab 进行演示。

相关的 Containerlab lab 可以在这里[获取](https://github.com/Hawkins-Sherpherd/srv6-lab1)。

# 为何选择 SRv6
- 当有 SRv6 作为第二数据平面，没有 BGP 运行的中间节点也可转发网际流量。当 BGP 进程崩溃时，节点仍可转发内部的网际流量，避免 BGP 路由黑洞。
- 多服务支持（L3VPN，流量工程，L2 传输，等等）。
- 市面上大多数 Linux 服务器支持它（包括 LXC 容器在内），无需额外的内核模块。

# 1 拓扑
该拓扑中的所有的路由器运行 FRR。

![拓扑](/img/srv6-lab.clab.png)

# 2 2 创建网络接口
END.DT4 需要一个 VRF 接口用于安装路由，否则路由会被拒绝。我们用一个绑定到 254 路由表上的 VRF 绕过这个限制。

IS-IS 需要一个 dummy 接口用于 SRv6 Locator 路由，默认情况下，它的名字是 sr0。

以下所有指令都**不是**持久化的，使用何种持久化方案取决于您的选择。
```
ip link add sr0 type dummy
ip link set sr0 up mtu 65536
ip link add name vrf-main type vrf table 254
ip link set vrf-main up
```

# 3 内核参数调整
以下所有指令都**不是**持久化的，使用何种持久化方案取决于您的选择。

不要忘记为每个传输 SRv6 流量的接口启用 SRv6。
```
sysctl -w net.ipv6.seg6_flowlabel=1
sysctl -w net.ipv6.conf.all.seg6_enabled=1
sysctl -w net.ipv6.conf.eth1.seg6_enabled=1
sysctl -w net.ipv6.conf.lo.seg6_enabled=1
sysctl -w net.ipv6.conf.all.forwarding=1
sysctl -w net.ipv4.ip_forward=1
sysctl -w net.vrf.strict_mode=1
```
**注意：**net.vrf.strict_mode 是一项关键参数，它决定了不同的 VRF 是否能够共享同一张路由表，当其值为 1 时，每个 VRF 都必须使用独立的路由表。
若其值不为 1，则 SRv6 IPv4 L3VPN 将无法正常工作，相关的 SID 路由将被拒绝。

net.vrf.strict_mode 会在每次 VRF 添加后重置为 0，为了避免网络运作的中断，请尽可能预先创建好所有需要用到的 VRF。

# 4 为默认路由表配置 BGP SRv6
FRR 中没有涉及 VRF 的配置，一切都是默认视图下的配置。

跳过 daemons，SRv6 Locator 和 IS-IS 配置，它们已在[前文](/2026/07/30/DN42-Over-SRv6-L3VPN-Deployment_cn.html)中提到。

在单播地址家族中发送 SRv6 封装信息，使用“sid export”而不是“sid vpn export”。

这是 R1 上的 BGP 单播地址家族配置：
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

# 5 完整配置
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

# 6 验证
# 6.1 检查 R1，R2 和 R3 的路由表:
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

# 6.2 从 Client1 和 Client2 进行 ping
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

# 7 已知限制
这段是从[先前的文章](/2026/07/30/DN42-Over-SRv6-L3VPN-Deployment_cn.html)复制来的。

## 7.1 NAT
当流量的目的地址的路由带有 SRv6 封装时，流量不会触发 netfilter 的 SNAT 规则，而是直接封装成 SRv6 流量发送过去。

## 7.2 路由器 IPv6 地址无法访问
由于未知原因，IPv4 和 IPv6 的 SRv6 解包调用路径并不一样，IPv4 回程流量能够正常切换到目标 VRF 查表，IPv6 流量却不能。不过不影响转发流量，只影响源或者目的地址在路由器上的流量。
