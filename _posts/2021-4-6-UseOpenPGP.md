---
layout: post
title: 使用 OpenPGP 保护你的通信和文件
---

 本文面向那些并不专业，但也希望加密自己的通信和文件的人。

过年的时候，我跟我的老同学谈到了一点事情。

他先是提到了公共电话，问为什么公共电话越来越难见到了。然后我提到了公共电话在一些场合中的必要性，比如当你不想向对方透露自己的身份的时候，电话号码会给你带来麻烦，公共电话就没有这个烦恼。他也是这么想的。

OpenPGP 虽然不能直接帮你保持匿名性，但它能够端到端地保护你的实际通信内容不被第三方看到。

## 在安卓手机上开始使用 OpenPGP

我是不太推荐从安卓开始使用 OpenPGP 的，因为各种事情做起来都不太方便，比如密钥管理和生成。个人建议在电脑上用 GnuPG 之类的软件生成密钥后再导入自己的手机。

我个人使用 OpenKeychain 这个软件，OpenKeychain 可在 F-Droid 上获得。

F-Droid 是一个安卓的开源软件源。有国内源，需要手动配置，除了初始化时是真的慢外，别的都还好，下载速度不错。

[可在此页面获取 F-Droid](https://f-droid.org/zh_Hans/)

[清华的 F-Droid 国内镜像源](https://mirrors.tuna.tsinghua.edu.cn/help/fdroid/)

在 F-Droid 中搜索 OpenKeychain 并安装。

进入 OpenKeychain，按右上角的菜单键，选择“管理我的密钥”。

点击“创建密钥”。

输入姓名，这个随便。

输入自己的电子邮件。

事实上到这里还没有完，我强烈推荐你再添加一个密码。

点击右上角的菜单键，选择“更改密钥配置”。

点击“变更密码”，然后输入密码。这个密码会在解密，签名，导出私钥时用到。

修改好后点击右上角的“保存”。

如果你想要让他人更方便地找到你的公钥，可以选择“上传至密钥服务器”。当然，如果只是私下里使用这个密钥，还是不要上传的好。

点击“创建密钥”。

然后，你可以使用自己的密钥来加密文件和信息了。

点击自己的密钥，里面会有带锁的文件和信息的图标。你可以通过这两个图标进入文件或信息的加密界面。

提醒一下，如果你希望别人发给你你看得见的加密信息，他得有你的公钥，也就是说你得想办法把自己的公钥发出去，比如发布到密钥服务器上。

## Windows 上开始使用 OpenPGP

在 Windows 上，我使用 GPG4Win。

[此处下载 GPG4Win ](https://www.gpg4win.org/get-gpg4win.html)

你可以选择 “$0” 选项以免费下载。

此处下载的 GPG4Win 带一个叫 Kleopatra 的图形化前端。

点击菜单栏中的“文件”，选择“新建密钥对”。

选择“创建个人 OpenPGP 密钥对”

鉴于这将用于通信，请填写姓名和自己的电子邮件地址。

勾选“Protect the generated key with a passphrase.”

输入一个足够安全的密码。

等待，它将出示生成的结果。

指纹用于验证公钥的真实性。

你可以通过文件的方式导出公钥，或是将它上传到密钥服务器上。

## 在 Linux 上使用 OpenPGP

在 Linux 上使用这些是很容易的。你可以在许多的 Linux 发行版上轻易地获得 GnuPG 。

具体的用法，网上随便一搜就有一大把，就不在此赘述了。