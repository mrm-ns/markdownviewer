# Keepalived 配置示例

在 Markdown 中使用 ` ```keepalived ` 代码块即可自动匹配 Keepalived 配色。

```keepalived
# 全局定义
global_defs {
    # 仅保留 router_id 改为 LVS_MASTER，备服务器 router_id 改为 LVS_SLAVE
    router_id LVS_MASTER

    # 强制严格检查机制，会造成故障恢复时间变长
    #vrrp_skip_check_adv_addr
    #vrrp_strict
    #vrrp_garp_interval 0
    #vrrp_gna_interval 0
}
vrrp_instance VI_1 {
    # 主备任意一个 stata 为 master 则为抢占模式
    state MASTER

    # 网卡名
    interface ens224

    # 虚拟路由器 ID，相当于集群 ID
    virtual_router_id 51

    # 优先级，数字越大优先级越高，主服务器应该比备高
    priority 100

    # 身份验证，不用更改
    advert_int 1
    authentication {
        auth_type PASS
        auth_pass 1111
    }
    # VIP
    virtual_ipaddress {
        192.168.77.21
    }
}
virtual_server 192.168.77.21 80 {
    delay_loop 6
    # 轮询算法
    lb_algo rr
    # 集群模式
    lb_kind NAT
    # 保持会话时间(秒)，删了就是默认值
    persistence_timeout 0
    # 匹配协议
    protocol TCP

    # 真实服务器 1
    real_server 192.168.77.28 80 {
        # 权重
        weight 1
        connect_timeout 3
        retry 3
        delay_before_retry 3
    }
    # 真实服务器 2
    real_server 192.168.77.42 80 {
        weight 2
        connect_timeout 3
        retry 3
        delay_before_retry 3
    }
}
```

## 使用方式

1. 打开本应用后，点击「打开文件」选择 `keepalived.md`。
2. 点击顶部「🎨 主题」。
3. 在预设主题中选择 **Keepalived Config**。
4. 也可以继续在颜色列表中微调，然后导出为 JSON 主题文件。
