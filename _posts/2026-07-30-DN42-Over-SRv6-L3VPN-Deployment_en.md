---
layout: post_dn42
title: "DN42 Over SRv6 L3VPN Deployment"
---
Segment Routing is a source-routing (forwarding path is pre-defined by source node) paradigm based technology, through encoding list of instruction called Segment into packet, the forwarding path of packet is defined.

# Why Segment Routing
Compared to other routing technologies, Segment Routing offers following advantages:
- Simple: No extra signal protocol (LDP, RSVP-TE) needed, SR route information can be propagated through IGPs (IS-IS, OSPF) with related extensions.
- Scalable: Since intermediate nodes don't need to maintain path status, they only need to execute corresponding instruction in Segment list defined in the packet, the resources can be saved more.
- Traffic Engineering: Segment Routing is based on source-routing paradigm, the forwarding path is programmable according to the intend.
- Extinguish of BGP blackhole: Introduce internal second dataplane (MPLS/SRv6), mapping many thousands of BGP routes to few second dataplane routes, making no-BGP intermediate nodes capable forwarding transit traffic, hence the resource is saved.

The following is a comparison of some popular routing technologies:

|Name|Simple|Scalable|Traffic Engineering|Extinguish of BGP blackhole|
| ----- | ----- | ----- | ----- | ----- |
|Plain IPv4/IPv6|Yes|Medium|No|No|
|MPLS and LDP|No|Medium|No|Yes|
|MPLS and RSVP-TE|No|Low|Yes|Yes|
|Segment Routing|Yes|High|Yes|Yes|

## Why SRv6
~~Because this is meant for SRv6.~~

Segment Routing can run on MPLS (SR-MPLS) and IPv6 (SRv6) dataplane.

Segment Routing over MPLS (SR-MPLS) is a kind of Segment Routing technology running on MPLS dataplane, it implements Segment Routing through encoding Segment list into MPLS label stack, no modification made to MPLS itself.

Segment Routing over IPv6 (SRv6) is a kind of Segment Routing technology running on IPv6 dataplane, it implements Segment Routing through introducing a new type of Routing Header: SR Header (SRH) for SRv6 capability.

Compared to SR-MPLS, SRv6 is a more popular option, it overcomes SR-MPLS at following scopes:
- Better compatibility: SRv6 can be deployed on edge nodes without deploying SRv6 in whole network domain, deployment can be advanced gradually, the intermediate node will transmit SRv6 packet as normal IPv6 packet, while SR-MPLS deployment touches whole network domain.
- More popular: SRv6 is mentioned more, and Linux has integrated it into the network stack without loading extra kernel module; SR-MPLS relied on MPLS, it requires extra kernal module, it's almost not possible for LXC containers.
- Larger address space: SRv6 is based on IPv6, one single SRv6 Locator can be assigned as a /64 network minimum, it provides 2^64 IPv6 addresses for SR network function, while MPLS the SR-MPLS use supports up to 2^20 address space, it's even a little less than the scale of global IPv4 routing table (over 1 million currently), the extensiblity is limited.

# Table of Content
- [Why Segment Routing](#why-segment-routing)
  - [Why SRv6](#why-srv6)
- [Table of Content](#table-of-content)
- [1 Preparation](#1-preparation)
  - [1.1 Install FRR](#11-install-frr)
  - [1.2 Kernel Parameter Adjustment](#12-kernel-parameter-adjustment)
  - [1.3 VRF Network Interface and VRF Configuration](#13-vrf-network-interface-and-vrf-configuration)
- [2 FRR Configuration](#2-frr-configuration)
  - [2.1 daemons configuration](#21-daemons-configuration)
  - [2.2 Configure Interface IP Address](#22-configure-interface-ip-address)
  - [2.3 Configure SRv6 Locator](#23-configure-srv6-locator)
  - [2.4 Configure IS-IS SRv6](#24-configure-is-is-srv6)
  - [2.5 Configure BGP SRv6](#25-configure-bgp-srv6)
  - [2.6 Configure SRv6 L3VPN](#26-configure-srv6-l3vpn)
  - [2.7 CAN1 Full FRR Configuration](#27-can1-full-frr-configuration)
- [3 Verification](#3-verification)
  - [3.1 Packet Capture](#31-packet-capture)
  - [3.2 Ping internal address](#32-ping-internal-address)
  - [3.3 Ping external address with transit node](#33-ping-external-address-with-transit-node)
  - [3.4 Access wiki.dn42](#34-access-wikidn42)
  - [3.5 View packet capture](#35-view-packet-capture)
- [4 Known limits](#4-known-limits)
  - [4.1 NAT](#41-nat)
  - [4.2 Router IPv6 address inaccessible](#42-router-ipv6-address-inaccessible)

# 1 Preparation
This article assumes the readers have:
- Basic Linux knowledge
- DN42 network setup and operation knowledge, the reader should have been read through [Getting Started](https://dn42.dev/howto/Getting-Started) and [Universal Network Requirements](https://dn42.dev/howto/networksettings) in DN42 Wiki
- Haven't yet set up a large scale DN42 network, or you are dare enough to flip it over

All node are set up with spec as follow:
- Run Debian Linux
- Use GRE over Wireguard for interconnection between nodes
- Run FRR routing software
- Use IS-IS as IGP
- Have DN42-GT and THIS-AS VRF
- Use DN42-GT for external interconnection
- Announce own network route through THIS-AS VRF

The DN42 over SRv6 L3VPN deployment shown in this article is implemented on my real DN42 network infrastructure.

## 1.1 Install FRR
For now, most convenient way to implement SRv6 on Linux is to use FRR, and my infrastructure is operating on FRR all time, too.

Every distro has its way to install, my nodes are mostly running Debian, the download can be found through [https://deb.frrouting.org](https://deb.frrouting.org).

If you are using Debian as I do, don't forget to install frr-rpki-rtrlib, it's dependency of RPKI protocol for FRR, ROA filter is a must option for DN42.

The regular FRR DN42 configuration can be referred from [FRRouting](https://dn42.dev/howto/frr).

## 1.2 Kernel Parameter Adjustment
Add on the basis of [Universal Network Requirements](https://dn42.dev/howto/networksettings):
```
net.ipv6.seg6_flowlabel=1
net.ipv6.conf.all.seg6_enabled=1
net.vrf.strict_mode=1
```
**Caution: **net.vrf.strict_mode is a critical parameter, it determines whether different VRF can share one routing table or not, when its value equals 1, every VRF has to have dedicate routing table. If it's value not equal to 1, the SRv6 IPv4 L3VPN won't work, the related SID routes will be rejected.

## 1.3 VRF Network Interface and VRF Configuration
net.vrf.strict_mode resets 0 everytime a new VRF adds, to prevent network operation interrupt, please create all VRF could be used at most.

All command followed are **NOT** persistent, the way to persist configuration is on yours.

The following command are used to create DN42-GT and THIS-AS VRF with iproute2:
```
ip link add DN42-GT type vrf table 300
ip link add THIS-AS type vrf table 100
ip link set DN42-GT up
ip link set THIS-AS up
```

IS-IS requires a dummy interface for SRv6 Locator route point to (by default it's sr0):
```
ip link add sr0 type dummy
ip link set sr0 up mtu 65536
```

IS-IS works on tunnel which carries Ethernet frame (gretap, l2tpv3) or supports OSI encapsulation (gre), so create GRE tunnel through IPv4 address on Wireguard interface:
```
ip link add azj1 type gre local 169.254.24.3 remote 169.254.24.17 nopmtudisc
sysctl -w net.ipv6.conf.azj1.seg6_enabled=1
```
Due to unknown reason, FRR can't send IS-IS traffic through ip6gre tunnel, it seems ip6gre don't support OSI encapsulation, since that, don't use IPv6 for GRE tunnel (but ip6gretap can do since it carries Ethernet frame).

# 2 FRR Configuration
Have every network node configured as follow, this article take my CAN1 node as example.

IP & SRv6 Locator Assignment:
- SRv6 Locator:5f00:3947:3::/48
- lo:
  - fdfa:7906:8262:ffff::3/128, for BGP L3VPN session use
  - 5f00:3947:3::1/128, for SRv6 source address use

## 2.1 daemons configuration
Enable BGP and IS-IS, and RPKI support.
```
# This file tells the frr package which daemons to start.
#
# Sample configurations for these daemons can be found in
# /usr/share/doc/frr/examples/.
#
# ATTENTION:
#
# When activating a daemon for the first time, a config file, even if it is
# empty, has to be present *and* be owned by the user and group "frr", else
# the daemon will not be started by /etc/init.d/frr. The permissions should
# be u=rw,g=r,o=.
# When using "vtysh" such a config file is also needed. It should be owned by
# group "frrvty" and set to ug=rw,o= though. Check /etc/pam.d/frr, too.
#
# The watchfrr, zebra and staticd daemons are always started.
#
bgpd=yes
ospfd=no
ospf6d=no
ripd=no
ripngd=no
isisd=yes
pimd=no
pim6d=no
ldpd=no
nhrpd=no
eigrpd=no
babeld=no
sharpd=no
pbrd=yes
bfdd=yes
fabricd=no
vrrpd=no
pathd=yes

#
# If this option is set the /etc/init.d/frr script automatically loads
# the config via "vtysh -b" when the servers are started.
# Check /etc/pam.d/frr if you intend to use "vtysh"!
#
vtysh_enable=yes
zebra_options="  -A 127.0.0.1 -s 90000000"
mgmtd_options="  -A 127.0.0.1"
bgpd_options="   -A 127.0.0.1 -M rpki"
ospfd_options="  -A 127.0.0.1"
ospf6d_options=" -A ::1"
ripd_options="   -A 127.0.0.1"
ripngd_options=" -A ::1"
isisd_options="  -A 127.0.0.1"
pimd_options="   -A 127.0.0.1"
pim6d_options="  -A ::1"
ldpd_options="   -A 127.0.0.1"
nhrpd_options="  -A 127.0.0.1"
eigrpd_options=" -A 127.0.0.1"
babeld_options=" -A 127.0.0.1"
sharpd_options=" -A 127.0.0.1"
pbrd_options="   -A 127.0.0.1"
staticd_options="-A 127.0.0.1"
bfdd_options="   -A 127.0.0.1"
fabricd_options="-A 127.0.0.1"
vrrpd_options="  -A 127.0.0.1"
pathd_options="  -A 127.0.0.1"


# If you want to pass a common option to all daemons, you can use the
# "frr_global_options" variable.
#
#frr_global_options=""


# The list of daemons to watch is automatically generated by the init script.
# This variable can be used to pass options to watchfrr that will be passed
# prior to the daemon list.
#
# To make watchfrr create/join the specified netns, add the the "--netns"
# option here. It will only have an effect in /etc/frr/<somename>/daemons, and
# you need to start FRR with "/usr/lib/frr/frrinit.sh start <somename>".
#
#watchfrr_options=""


# configuration profile
#
#frr_profile="traditional"
#frr_profile="datacenter"


# This is the maximum number of FD's that will be available.  Upon startup this
# is read by the control files and ulimit is called.  Uncomment and use a
# reasonable value for your setup if you are expecting a large number of peers
# in say BGP.
#
#MAX_FDS=1024

# Uncomment this option if you want to run FRR as a non-root user. Note that
# you should know what you are doing since most of the daemons need root
# to work. This could be useful if you want to run FRR in a container
# for instance.
# FRR_NO_ROOT="yes"

# For any daemon, you can specify a "wrap" command to start instead of starting
# the daemon directly. This will simply be prepended to the daemon invocation.
# These variables have the form daemon_wrap, where 'daemon' is the name of the
# daemon (the same pattern as the daemon_options variables).
#
# Note that when daemons are started, they are told to daemonize with the `-d`
# option. This has several implications. For one, the init script expects that
# when it invokes a daemon, the invocation returns immediately. If you add a
# wrap command here, it must comply with this expectation and daemonize as
# well, or the init script will never return. Furthermore, because daemons are
# themselves daemonized with -d, you must ensure that your wrapper command is
# capable of following child processes after a fork() if you need it to do so.
#
# If your desired wrapper does not support daemonization, you can wrap it with
# a utility program that daemonizes programs, such as 'daemonize'. An example
# of this might look like:
#
# bgpd_wrap="/usr/bin/daemonize /usr/bin/mywrapper"
#
# This is particularly useful for programs which record processes but lack
# daemonization options, such as perf and rr.
#
# If you wish to wrap all daemons in the same way, you may set the "all_wrap"
# variable.
#
#all_wrap=""
```
## 2.2 Configure Interface IP Address
Edit /etc/frr/frr.conf, add configuration followed:

lo:
```
!
interface lo
 ipv6 address 5f00:3947:3::1/128
 ipv6 address fdfa:7906:8262:ffff::3/128
 ipv6 router isis 1
 mpls enable
exit
!
```

## 2.3 Configure SRv6 Locator
IANA has assigned 5f00::/16 for SRv6 SID use currently, I have took 5f00:3947::/32 within as my SRv6 network block, then assign /48 size 5f00:3947:x::/48 for every node's SRv6 Locator, use usid-f3216 for SID assignment format.

Edit /etc/frr/frr.conf, add configuration followed:
```
!
segment-routing
 srv6
  encapsulation
   source-address 5f00:3947:3::1
  exit
  locators
   locator MAIN
    prefix 5f00:3947:3::/48 block-len 32 node-len 16
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
If you want to use your own DN42 IPv6 as SRv6 Locator, then assign every node /64 size SRv6 Locator, please use usid-f4816 instead.

## 2.4 Configure IS-IS SRv6
After SRv6 Locator configuration, the IS-IS configuration is also required for announcing SRv6 Locator route.

As why IS-IS, because IS-IS is only IGP supports SRv6 in FRR for now.

IS-IS uses NET (Network Entity Title) in CLNS format to identify node, it's length variable, consisted mainly in two parts:
- Area ID (1~13 bytes)
- System ID (7 bytes)
  - Station ID (6 bytes)
  - Selector (1 byte)

The Area ID format has following popular varient:
- Single byte Area Address
  - 00
- AFI (1 byte) + Area (2 bytes) AFI (1 byte) + Area (2 bytes)
  - 49.0000
- AFI (1 byte) + Domain (2 bytes) + Area (2 bytes) 
  - 49.0000.0000

CAN1 has assined NET 49.0000.1720.2020.9096.00, add follow into /etc/frr/frr.conf:
```
!
router isis 1
 is-type level-1
 net 49.0000.1720.2020.9096.00
 lsp-mtu 1277
 segment-routing on
 segment-routing srv6
  locator MAIN
 exit
exit
!
```

## 2.5 Configure BGP SRv6
After configuration of SRv6 route announcement through IGP, BGP SRv6 Locator configuration is also needed, BGP L3VPN will use this SRv6 Locator to generate then bind corresponding SID for VRF.

Add follow to BGP configuration block in /etc/frr/frr.conf:
```
 !
 segment-routing srv6
  locator MAIN
 exit
 !
```
If you don't know where to insert, you may refer complete configuration in later part.

## 2.6 Configure SRv6 L3VPN
Setup BGP L3VPN Peer in default VRF:
```
router bgp 4242423947
 bgp router-id 172.20.209.96
 no bgp default ipv4-unicast
 neighbor ibgp peer-group
 neighbor ibgp remote-as 4242423947
 neighbor ibgp update-source lo
 neighbor ibgp capability extended-nexthop
 neighbor fdfa:7906:8262:ffff::1 peer-group ibgp
 neighbor fdfa:7906:8262:ffff::1 description hkg1
 neighbor fdfa:7906:8262:ffff::6 peer-group ibgp
 neighbor fdfa:7906:8262:ffff::6 description fra1
```
Activate BGP L3VPN Peer:
```
address-family ipv4 vpn
  neighbor ibgp activate
 exit-address-family
```
```
address-family ipv6 vpn
  neighbor ibgp activate
 exit-address-family
```
If you don't know where to insert, you may refer complete configuration in later part.

Configure VPN import/export, RD, RT import/export and SID binding for IPv4 Unicast and IPv6 Unicast address family in **corresponding VRF**:
```
 address-family ipv4 unicast
  sid vpn export auto
  rd vpn export 172.20.209.96:100
  rt vpn import 4242423947:100 4242423947:300 4242423947:301 4242423947:500
  rt vpn export 4242423947:100
  export vpn
  import vpn
 exit-address-family
 !
 address-family ipv6 unicast
  sid vpn export auto
  rd vpn export 172.20.209.96:100
  rt vpn import 4242423947:100 4242423947:300 4242423947:301 4242423947:500
  rt vpn export 4242423947:100
  export vpn
  import vpn
 exit-address-family
```
If you don't know where to insert, you may refer complete configuration in later part.

## 2.7 CAN1 Full FRR Configuration
I provide full FRR configuration of CAN1 without redundant route-map and eBGP peer for reference, the VRF RPKI and BFD configuration is also included.
```
frr version 10.6.1
frr defaults traditional
hostname SERNET-CAN1
log syslog informational
service integrated-vtysh-config
!
ip prefix-list dn42-subnet seq 1100 permit 172.20.0.0/14 le 32
ip prefix-list dn42-subnet seq 2001 permit 10.100.0.0/14 le 32
ip prefix-list dn42-subnet seq 2002 permit 10.127.0.0/16 le 32
ip prefix-list dn42-subnet seq 2003 permit 10.0.0.0/8 ge 15 le 24
ip prefix-list dn42-subnet seq 3001 permit 172.31.0.0/16 le 32
ip prefix-list dn42-subnet seq 9999 deny 0.0.0.0/0 le 32
ip prefix-list global seq 1 permit 172.20.209.64/26
ip prefix-list local seq 2 permit 172.20.209.120/29
ip prefix-list local seq 3 permit 172.20.209.96/28
ip prefix-list vrf_local seq 1 permit 169.254.23.0/24 le 32
!
ipv6 prefix-list dn42-subnet seq 1 permit fd00::/8 ge 44 le 64
ipv6 prefix-list dn42-subnet seq 65535 deny ::/0 le 128
ipv6 prefix-list global seq 1 permit fdfa:7906:8262::/48
!
route-map inbound permit 10
 on-match next
 set local-preference 100
exit
!
route-map inbound permit 20
 match as-path adj
 on-match next
 set local-preference +150
exit
!
route-map inbound permit 21
 match community region
 on-match next
 set local-preference +110
exit
!
route-map inbound permit 22
 match community country
 set local-preference +110
exit
!
route-map inbound permit 65535
 call rpki
exit
!
route-map local-as-only permit 10
 match as-path self
exit
!
route-map outbound permit 10
 call set-community
 match as-path self
 match rpki valid
exit
!
route-map outbound permit 20
 call rpki
exit
!
route-map redistribute-connected permit 10
 match ip address prefix-list dn42-subnet
exit
!
route-map redistribute-connected permit 20
 match ipv6 address prefix-list dn42-subnet
exit
!
route-map rpki permit 10
 match rpki valid
exit
!
route-map rpki permit 20
 match rpki notfound
 on-match goto 40
exit
!
route-map rpki deny 30
 match rpki invalid
exit
!
route-map rpki permit 40
 match ip address prefix-list dn42-subnet
exit
!
route-map rpki permit 41
 match ipv6 address prefix-list dn42-subnet
exit
!
route-map set-community permit 10
 set community 64511:52 64511:1156
exit
!
ip route 172.20.0.0/14 dn42-service nexthop-vrf THIS-AS
ip route 172.31.0.0/16 dn42-service nexthop-vrf THIS-AS
ip route 172.16.135.0/24 dn42-service nexthop-vrf THIS-AS
ipv6 route fd00::/8 dn42-service nexthop-vrf THIS-AS
ipv6 route fdfa:7906:8262:c530::/64 dn42-service nexthop-vrf THIS-AS
ip router-id 172.20.209.96
!
vrf DN42-GT
 ipv6 route fdfa:7906:8262:c530::/64 dn42-service
 rpki
  rpki cache tcp 169.254.23.1 8082 preference 10
 exit
exit-vrf
!
vrf THIS-AS
 ip route 0.0.0.0/0 ens5 nexthop-vrf default
 ip route 10.0.0.0/8 Null0
 ip route 172.20.0.0/14 Null0
 ip route 10.127.217.0/24 Null0
 ip route 172.20.209.64/26 Null0
 ipv6 route fd00::/8 Null0
 ipv6 route fdfa:7906:8262::/48 Null0
 ipv6 route fdfa:7906:8262:cf00::/56 Null0
 ipv6 route fdfa:7906:8262:c530::/64 dn42-service
 ipv6 route fdfa:7906:8262:cf00::/64 access-hawkins
exit-vrf
!
vrf DN42-PT
exit-vrf
!
vrf NEO-HAWKINS
exit-vrf
!
interface DN42-GT
 ip address 169.254.23.1/32
exit
!
interface THIS-AS
 ip address 10.127.217.66/32
 ip address 172.20.209.96/32
 ipv6 address fdfa:7906:8262:f::3/128
 ipv6 address fdfa:7906:8262:ffff::3/128
exit
!
interface azj1
 ipv6 router isis 1
 isis bfd
 isis bfd profile internet
 isis fast-reroute lfa
 isis network point-to-point
 mpls enable
exit
!
interface ctu1
 ipv6 router isis 1
 isis bfd
 isis bfd profile internet
 isis fast-reroute lfa
 isis network point-to-point
 mpls enable
 link-params
 exit-link-params
exit
!
interface dn42-service
 pbr-policy to-dn42
exit
!
interface fra1
 ipv6 router isis 1
 isis bfd
 isis bfd profile internet
 isis fast-reroute lfa
 isis metric 20
 isis network point-to-point
 mpls enable
 link-params
 exit-link-params
exit
!
interface hkg1
 ipv6 router isis 1
 isis bfd
 isis bfd profile internet
 isis fast-reroute lfa
 isis metric 4
 isis network point-to-point
 mpls enable
 link-params
 exit-link-params
exit
!
interface lo
 ipv6 address 5f00:3947:3::1/128
 ipv6 address fdfa:7906:8262:ffff::3/128
 ipv6 router isis 1
 mpls enable
exit
!
interface sjc1
 ipv6 router isis 1
 isis bfd
 isis bfd profile internet
 isis fast-reroute lfa
 isis metric 20
 isis network point-to-point
 mpls enable
 link-params
 exit-link-params
exit
!
interface tyo1
 ipv6 router isis 1
 isis bfd
 isis bfd profile internet
 isis fast-reroute lfa
 isis metric 15
 isis network point-to-point
 mpls enable
 link-params
 exit-link-params
exit
!
interface wds1
 ipv6 router isis 1
 isis bfd
 isis bfd profile internet
 isis fast-reroute lfa
 isis network point-to-point
 mpls enable
 link-params
 exit-link-params
exit
!
router bgp 4242423947
 bgp router-id 172.20.209.96
 no bgp default ipv4-unicast
 neighbor ibgp peer-group
 neighbor ibgp remote-as 4242423947
 neighbor ibgp update-source lo
 neighbor ibgp capability extended-nexthop
 neighbor fdfa:7906:8262:ffff::1 peer-group ibgp
 neighbor fdfa:7906:8262:ffff::1 description hkg1
 neighbor fdfa:7906:8262:ffff::6 peer-group ibgp
 neighbor fdfa:7906:8262:ffff::6 description fra1
 !
 segment-routing srv6
  locator MAIN
  no srv6-only
 exit
 !
 address-family ipv4 unicast
  label vpn export auto
  sid vpn export auto
  rd vpn export 172.20.209.96:0
  rt vpn export 4242423947:100
  export vpn
 exit-address-family
 !
 address-family ipv4 vpn
  neighbor ibgp activate
 exit-address-family
 !
 address-family ipv6 unicast
  label vpn export auto
  sid vpn export auto
  rd vpn export 172.20.209.96:0
  rt vpn export 4242423947:100
  export vpn
 exit-address-family
 !
 address-family ipv6 vpn
  neighbor ibgp activate
 exit-address-family
exit
!
router bgp 4242423947 vrf DN42-GT
 bgp router-id 172.20.209.96
 no bgp enforce-first-as
 no bgp default ipv4-unicast
 no bgp network import-check
 !
 address-family ipv4 unicast
  neighbor ebgp-DN42-GT activate
  neighbor ebgp-DN42-GT route-map inbound in
  neighbor ebgp-DN42-GT route-map outbound out
  neighbor ebgp4-DN42-GT activate
  neighbor ebgp4-DN42-GT route-map inbound in
  neighbor ebgp4-DN42-GT route-map outbound out
  neighbor ebgp6-DN42-GT activate
  sid vpn export auto
  rd vpn export 172.20.209.96:300
  rt vpn import 4242423947:100 4242423947:300 4242423947:301 4242423947:500
  rt vpn export 4242423947:300
  export vpn
  import vpn
 exit-address-family
 !
 address-family ipv6 unicast
  neighbor ebgp-DN42-GT activate
  neighbor ebgp-DN42-GT route-map inbound in
  neighbor ebgp-DN42-GT route-map outbound out
  neighbor ebgp6-DN42-GT activate
  neighbor ebgp6-DN42-GT route-map inbound in
  neighbor ebgp6-DN42-GT route-map outbound out
  sid vpn export auto
  rd vpn export 172.20.209.96:300
  rt vpn import 4242423947:100 4242423947:300 4242423947:301 4242423947:500
  rt vpn export 4242423947:300
  export vpn
  import vpn
 exit-address-family
exit
!
router bgp 4242423947 vrf THIS-AS
 no bgp default ipv4-unicast
 neighbor 172.16.135.2 remote-as 4242423947
 neighbor 172.16.135.2 description exabgp
 neighbor fdfa:7906:8262:c530::2 remote-as 4242423947
 neighbor fdfa:7906:8262:c530::2 description exabgp
 !
 address-family ipv4 unicast
  network 10.127.217.0/24
  network 10.127.217.2/32
  network 10.127.217.66/32
  network 172.16.128.0/24
  network 172.20.209.64/26
  network 172.20.209.96/32
  redistribute connected route-map redistribute-connected
  neighbor 172.16.135.2 activate
  sid vpn export auto
  rd vpn export 172.20.209.96:100
  rt vpn import 4242423947:100 4242423947:300 4242423947:301 4242423947:500
  rt vpn export 4242423947:100
  export vpn
  import vpn
 exit-address-family
 !
 address-family ipv6 unicast
  network fdfa:7906:8262::/48
  network fdfa:7906:8262:f::3/128
  network fdfa:7906:8262:c500::/64
  network fdfa:7906:8262:c530::/64
  network fdfa:7906:8262:cf00::/56
  redistribute connected route-map redistribute-connected
  neighbor fdfa:7906:8262:c530::2 activate
  sid vpn export auto
  rd vpn export 172.20.209.96:100
  rt vpn import 4242423947:100 4242423947:300 4242423947:301 4242423947:500
  rt vpn export 4242423947:100
  export vpn
  import vpn
 exit-address-family
exit
!
router isis 1
 is-type level-1
 net 49.0000.1720.2020.9096.00
 lsp-mtu 1277
 segment-routing on
 segment-routing srv6
  locator MAIN
 exit
exit
!
bgp as-path access-list adj seq 5 permit ^[0-9]*$
bgp as-path access-list always-send seq 1 permit ^$
bgp as-path access-list self seq 5 permit ^$
!
bgp community-list standard country seq 1 permit 64511:1156
bgp community-list standard region seq 1 permit 64511:52
bgp extcommunity-list standard no-import-rt seq 1 permit rt 4242423947:0
bgp extcommunity-list standard premium-rt seq 1 permit rt 4242423947:100
bgp extcommunity-list standard premium-rt seq 2 permit rt 4242423947:301
!
pbr-map to-dn42 seq 1
 match dst-ip fd00::/8
 set vrf THIS-AS
exit
!
pbr-map to-dn42 seq 2
 match dst-ip 10.0.0.0/8
 set vrf THIS-AS
exit
!
pbr-map to-dn42 seq 3
 match dst-ip 172.20.0.0/14
 set vrf THIS-AS
exit
!
pbr-map to-dn42 seq 4
 match dst-ip 172.31.0.0/16
 set vrf THIS-AS
exit
!
pbr-map to-dn42 seq 5
 match dst-ip 172.16.128.0/24
 set vrf THIS-AS
exit
!
segment-routing
 srv6
  encapsulation
   source-address 5f00:3947:3::1
  exit
  locators
   locator MAIN
    prefix 5f00:3947:3::/48 block-len 32 node-len 16
    behavior usid
    format usid-f3216
   exit
   !
  exit
  !
 exit
 !
 traffic-eng
 exit
exit
!
bfd
 profile internet
  detect-multiplier 5
  transmit-interval 1000
  receive-interval 1000
 exit
 !
exit
!
```

# 3 Verification
The verification next is proceeded on a PC connected to DN42 network through CAN1.
## 3.1 Packet Capture
Use Wireshark SSH remote capture for link hkg1 on CAN1 which connects to HKG1.

To allow readers view SRv6 capture more intuitive, PCAP filter is configured:
![pcap filter](/img/屏幕截图%202026-07-30%20182844.png)

Then packet capture can be initiated.
## 3.2 Ping internal address
172.20.209.64 is configured on HKG1, hence it must go through link hkg1:
```
PS C:\Users\haksr> ping 172.20.209.64

Pinging 172.20.209.64 with 32 bytes of data:
Reply from 172.20.209.64: bytes=32 time=22ms TTL=63
Reply from 172.20.209.64: bytes=32 time=24ms TTL=63
Reply from 172.20.209.64: bytes=32 time=24ms TTL=63
Reply from 172.20.209.64: bytes=32 time=24ms TTL=63

Ping statistics for 172.20.209.64:
    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),
Approximate round trip times in milli-seconds:
    Minimum = 22ms, Maximum = 24ms, Average = 23ms
```
## 3.3 Ping external address with transit node
Traffic to wiki.dn42 (172.23.0.80) go through hkg1 too:
```
Pinging 172.23.0.80 with 32 bytes of data:
Reply from 172.23.0.80: bytes=32 time=29ms TTL=63
Reply from 172.23.0.80: bytes=32 time=28ms TTL=63
Reply from 172.23.0.80: bytes=32 time=32ms TTL=63
Reply from 172.23.0.80: bytes=32 time=26ms TTL=63

Ping statistics for 172.23.0.80:
    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),
Approximate round trip times in milli-seconds:
    Minimum = 26ms, Maximum = 32ms, Average = 28ms
```
## 3.4 Access wiki.dn42
![wiki.dn42](/img/屏幕截图 2026-07-30 183922.png)
## 3.5 View packet capture
![packet capture](/img/屏幕截图%202026-07-30%20184327.png)
[srv6_2026-07-30-1838](/blob/srv6_2026-07-30-1838.pcapng)

# 4 Known limits
## 4.1 NAT
When destination route has SRv6 encapsulation, the traffic won't trigger SNAT rule in netfilter, instead, it encapsulates into SRv6 traffic directly then send out.

## 4.2 Router IPv6 address inaccessible
Due to unknown reason, the call path of SRv6 decapsulation is different for IPv4 and IPv6, the IPv4 return traffic can lookup destined VRF normally, while IPv6 don't. However, this don't affect transit traffic, only traffic sources or destined to the router is affected.
