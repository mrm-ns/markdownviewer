/* Dockerfile 代码块高亮子配置
 *
 * 在 Bash 规则基础上扩展 Dockerfile 指令：
 *   - Dockerfile 指令（FROM / RUN / LABEL / COPY ...）作为关键字高亮（行首匹配，优先级最高）
 *   - 保留 Bash 的注释、字符串、变量、选项、内建/外部命令等规则，
 *     因为 RUN/CMD 行内通常就是 shell 命令
 *
 * 兼容写法：dockerfile / Dockerfile / DockerFile / docker / Docker
 */
(function () {
  'use strict';

  window.MD_SYNTAX_RULES = window.MD_SYNTAX_RULES || {};

  window.MD_SYNTAX_RULES.dockerfile = [
    // ---------- Dockerfile 指令（必须放在最前，行首优先匹配） ----------
    // 构建类
    { className: 'keyword', pattern: /^[ \t]*(?:FROM|RUN|CMD|LABEL|MAINTAINER|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL)(?=\s|$)/im },
    // 多阶段构建 / 平台参数等常见标志
    { className: 'built_in', pattern: /(?<!\S)(?:AS|as)(?!\S)/ },
    // ---------- 注释 ----------
    // 与 Bash 一致：# 仅在行首或左侧全为空白时才是注释，
    // 避免 RUN 行里 [root@docker ~]# cmd 这类提示符把 # 之后当成注释
    { className: 'comment', pattern: /(?<!\S)#[^\n]*/ },
    // ---------- 字符串 ----------
    { className: 'string', pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
    // ---------- 数字 ----------
    { className: 'number', pattern: /\b\d+\b/ },
    // ---------- 变量（$VAR / ${VAR}） ----------
    { className: 'variable', pattern: /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/ },
    // ---------- 行首 $ 提示符（Bash 兼容） ----------
    { className: 'bashPrompt', pattern: /^\s*\$[ \t]/ },
    // ---------- 命令行选项（-y / --no-cache 等） ----------
    { className: 'bashOption', pattern: /(?:^|\s)(?:-[a-zA-Z][a-zA-Z0-9_-]*|--[a-zA-Z0-9][a-zA-Z0-9_-]*)/ },
    // ---------- 符号 ----------
    { className: 'symbol', pattern: /[><+*()@!~=|&;{}\[\]:?]/ },
    // ---------- Bash 内建命令（RUN/CMD 行内） ----------
    { className: 'built_in', pattern: /(?<!\S)(?:alias|bg|cd|echo|exit|export|fg|jobs|kill|local|pwd|read|return|source|test|unalias|history)(?!\S)/ },
    // ---------- 外部命令 / 函数名（含容器工具） ----------
    { className: 'function', pattern: /(?<!\S)(?:ab|apt|apt-get|arp|awk|blkid|cat|chmod|chown|chkconfig|clear|cp|cobbler|curl|dig|dnf|dpkg|egrep|emacs|fdisk|fgrep|find|grep|groupadd|gunzip|gzip|head|hostname|ifconfig|ip|iptables|ipvsadm|iscsiadm|journalctl|keepalived|less|ln|ls|lsblk|lvchange|lvconvert|lvcreate|lvdisplay|lvextend|lvm|lvreduce|lvremove|lvresize|lvscan|mkdir|mkfs|more|mount|mv|nano|netstat|nmap|nohup|nslookup|openssl|pacman|parted|passwd|ping|pkill|ps|pvchange|pvcreate|pvdisplay|pvremove|pvresize|pvs|pvscan|rm|rmdir|route|rpm|rsync|scp|sed|service|ss|ssh|su|sudo|systemctl|systemd-analyze|systemd-cat|tail|tar|targetcli|tcpdump|touch|traceroute|umount|unzip|useradd|userdel|usermod|vgchange|vgconvert|vgcreate|vgdisplay|vgextend|vgreduce|vgremove|vgscan|vi|vim|wget|xz|yum|zip|zcat|docker|docker-compose|buildah|podman|skopeo)(?!\S)/ },
    // ---------- Shell 语法关键字 ----------
    { className: 'keyword', pattern: /(?<!\S)(?:if|then|else|elif|fi|for|while|do|done|case|esac|function|add|remove|delete|reload|start|stop|List|get|post|push|pull|put|run|true|false)(?!\S)/ }
  ];

  // 兼容各种写法（语言名已由 normalizeFenceLang 归一为小写）
  window.MD_SYNTAX_RULES.docker = window.MD_SYNTAX_RULES.dockerfile;
})();
