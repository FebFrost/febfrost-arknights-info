# Maintenance

- `src/birthday.ts` 维护生日日期计算、分组和消息格式化。
- `src/assets.ts` 维护 `ark-info` 头像资源解析。
- `src/render.ts` 维护 HTML 生成和 Puppeteer 截图渲染，后续共享渲染层重构完成后可迁移到共享入口。
- `src/index.ts` 维护 Koishi 配置、数据库缓存、命令和定时推送。
- `todo.md` 记录后续开发与测试计划，新增功能前先更新计划。
- `ark-info` 目前使用 `^0.1.1`。如果包的导出、字段或返回结构变化，优先在 `src/birthday.ts` 增加兼容层和测试。
