---
layout: post_dn42
title: "在 SR-MPLS 网络上使用 Netns 和 TC 创建 EoMPLS 伪线"
---
EoMPLS (Ethernet over MPLS) 是一种在 MPLS 网络上传输以太网流量的技术。

相较在同一二层域内直接传输以太网流量，它具有如下优势：
- 易于管理
- 更完善的 QoS 支持
- 流量转发路径可控

而相较在 IP 网络上传输以太网流量，MPLS 又具有与现有的电信网络基础设施（LDP，RSVP，BGP 等）高度集成，开销更小（IPv4 首部开销 20 字节起步，MPLS 每个标签占用 4 字节）的优势。

在电信网络中，使用 MPLS 承载流量传输业务比使用 IP 更加流行。

尽管 EoMPLS 有这样那样的优势，但它和我们，普通的 Linux 玩家没有太大的缘分：Linux 并没有原生的 MPLS 伪线支持，而社区对此也没有太多的关注。

幸运的是，目前 Linux 的网络协议栈和现成的工具已经足以支撑静态的 MPLS 伪线。无需额外的编程，只需要一张现成的 MPLS 网络，以及一些命令。

我强烈建议使用 SR-MPLS 组建这张 MPLS 网络，在 SR-MPLS 网络中，我们可以为每个环回接口地址配置全域唯一的标签。这会为我们的 MPLS 伪线业务带来很大的帮助，特别是没有信令的情况下，我们需要手动配置标签。

目前，[frr](https://frrouting.org) 是在 Linux 上组建 MPLS 网络的最优选择，它支持 SR-MPLS。

关于如何使用 frr 组建 SR-MPLS 网络，请参阅：
- [https://docs.frrouting.org/en/stable-10.5/isisd.html#segment-routing](https://docs.frrouting.org/en/stable-10.5/isisd.html#segment-routing)
- [https://docs.frrouting.org/en/stable-10.5/ospfd.html#segment-routing](https://docs.frrouting.org/en/stable-10.5/ospfd.html#segment-routing)
- [https://www.uni-koeln.de/~pbogusze/posts/FRRouting_IS-IS_Segment_Routing_tech_demo.html](https://www.uni-koeln.de/~pbogusze/posts/FRRouting_IS-IS_Segment_Routing_tech_demo.html)
- [https://www.uni-koeln.de/~pbogusze/posts/FRRouting_SR_Segment_Routing_tech_demo.html](https://www.uni-koeln.de/~pbogusze/posts/FRRouting_SR_Segment_Routing_tech_demo.html)
- 以及更多……

## 网络拓扑

```
    +-------------------+  +-------------------+
    |    SR Router 1    |  |    SR Router 1    |
    |   default netns   |  |   pw_inter netns  |
    |                   |  |                   |
    |            pw_in ====== pw_out           |
    |                   |  |                   |
    |              pw0 ====== pw0_ns           |
    |                   |  |                   |
    |      can1         |  |                   |
    +-------||----------+  +-------------------+
            ||
            ||
    +-------||----------+
    |                   |
    |  SR-MPLS Network  |
    |                   |
    +-------||----------+
            ||
            ||
    +-------||----------+  +-------------------+
    |      gz1          |  |                   |
    |                   |  |                   |
    |    SR Router 2    |  |    SR Router 2    |
    |   default netns   |  |   pw_inter netns  |
    |                   |  |                   |
    |            pw_in ====== pw_out           |
    |                   |  |                   |
    |              pw0 ====== pw0_ns           |
    +-------------------+  +-------------------+
```

## 创建 Netns 和 Veth 对
在 SR Router 1 上执行如下命令：
```
ip netns add pw_inter
ip link add pw0 type veth peer pw0_ns
ip link add pw_in type veth peer pw_out
ip link set pw0 up
ip link set pw_in up
ip link set pw0_ns netns pw_inter
ip link set pw_out netns pw_inter
```
进入 pw_inter 并启用各个接口：
```
ip netns exec pw_inter bash
ip link set pw0_ns up
ip link set pw_out up
exit
```

将以上步骤在 SR Router 2 上重复一遍。

## 配置网络接口的 IP 地址
在 SR Router 1 上执行如下命令：
```
ip addr add 192.168.96.1/24 dev pw0
```
在 SR Router 2 上执行如下命令：
```
ip addr add 192.168.96.2/24 dev pw0
```

## 在 Netns 内配置 TC 规则
在两个节点上都执行如下命令：
```
ip netns exec pw_inter bash
ip link show pw0_ns 
ip link show pw_out 
tc qdisc add dev pw0_ns ingress
tc filter add dev pw0_ns ingress matchall \
    action mpls mac_push protocol mpls_uc label 200 \
    action mpls mac_push protocol mpls_uc label (这里填对端环回地址的标签) \
    action vlan push_eth dst_mac (这里填 pw_out 的 mac 地址) src_mac (这里填 pw0_ns 的 mac 地址) \
    action mirred egress redirect dev pw_out
tc qdisc add dev pw_out ingress
tc filter add dev pw_out ingress protocol mpls_uc \
    flower mpls_label 200 mpls_bos 1 \
    action vlan pop_eth protocol teb \
    action mirred egress redirect dev pw0_ns 
exit
```

## 配置去往 pw_inter 的回程 MPLS 路由
在两个节点上都执行如下命令：
```
ip -M route add 200 as 200 dev pw_in
```

## 测试
我在我的 SERNET-HET1 节点上进行如下测试，它相当于本文中的 SR Router 1：
```
root@SERNET-HET1:~# ping 192.168.96.2 -c 4
PING 192.168.96.2 (192.168.96.2) 56(84) bytes of data.
64 bytes from 192.168.96.2: icmp_seq=1 ttl=64 time=217 ms
64 bytes from 192.168.96.2: icmp_seq=2 ttl=64 time=214 ms
64 bytes from 192.168.96.2: icmp_seq=3 ttl=64 time=218 ms
64 bytes from 192.168.96.2: icmp_seq=4 ttl=64 time=213 ms

--- 192.168.96.2 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3000ms
rtt min/avg/max/mdev = 212.652/215.414/217.973/2.166 ms
```

反过来：
```
root@SERNET-SJC1:~# ping 192.168.96.1 -c 4
PING 192.168.96.1 (192.168.96.1) 56(84) bytes of data.
64 bytes from 192.168.96.1: icmp_seq=1 ttl=64 time=213 ms
64 bytes from 192.168.96.1: icmp_seq=2 ttl=64 time=213 ms
64 bytes from 192.168.96.1: icmp_seq=3 ttl=64 time=214 ms
64 bytes from 192.168.96.1: icmp_seq=4 ttl=64 time=214 ms

--- 192.168.96.1 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3004ms
rtt min/avg/max/mdev = 212.801/213.423/214.120/0.537 ms
root@SERNET-SJC1:~#
```

中间节点的抓包：
![截图](/img/2026-03-07-034150.png)

抓包文件：
[2026-03-07-0340.pcapng](/blob/2026-03-07-0340.pcapng)