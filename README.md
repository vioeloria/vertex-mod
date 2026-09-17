# 新增 IRC下载 辅种 RSS代理 汇总下载器速度

#### Wiki
[https://wiki.vertex-app.top](https://wiki.vertex-app.top)

#### Docker 部署

仓库自带 `Dockerfile` 与 `docker-compose.yml`，可直接从源码构建镜像（会自动编译前端静态资源）。

1. 构建并启动：

```bash
docker compose up -d --build
```

2. 仅构建镜像：

```bash
docker build -t vioeloria/vertex:latest .
```

3. 推送到自己的镜像仓库：

```bash
docker login
docker tag vioeloria/vertex:latest <你的用户名>/vertex:latest
docker push <你的用户名>/vertex:latest
```

4. 直接使用已构建的镜像（不重新构建）：编辑 `docker-compose.yml` 注释掉 `build:` 段，再执行：

```bash
docker compose up -d
```

访问 `http://<主机IP>:3000`，所有数据保存在宿主机的 `./vertex` 目录（config / data / db / logs / torrents）。

> 基础镜像为 `lswl/vertex-base:latest`，如需更换可修改 `Dockerfile` 第二阶段的 `FROM`。

#### 打赏，如果你觉得这个项目对你有帮助，可以对我打赏，感谢！

<figure><img src="https://lswl.in/assets/images/alipay_qrcode.png" alt="" width="375"><figcaption></figcaption></figure>
