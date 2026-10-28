import json,re
orig=json.load(open('orig198.json', encoding='utf-8'))
catmap={'sec':'sec','db':'db','dist':'dist','cache':'cache','net':'net','sre':'sre','devops':'devops'}
L1=[12,17,18,29,70,116,118,195]
L2=[1,2,3,4,6,13,15,19,21,22,24,25,26,30,33,36,41,43,44,46,48,56,57,59,60,61,119,127,128,130,131,168,169,185,186,188,196,198,141,152,100,104,114]
L4=[32,40,65,66,67,68,73,74]+list(range(76,90))+[110,111,112,113,136,139,140,147,159,164,172,174,181,182,193,194]
def lvl(i):
    return '初级' if i in L1 else '中级' if i in L2 else '进阶' if i in L4 else '高级'
# new concepts: (en, zh, level, cat)
NEW=[
# 初级 basics
("Computer Basics: Files & Paths","文件、文件夹与路径","初级","base"),
("Terminal / Command Line","终端 / 命令行","初级","base"),
("Frontend","前端","初级","base"),
("Backend","后端","初级","base"),
("Full Stack","全栈","初级","base"),
("Server","服务器","初级","base"),
("Local vs Cloud","本地 vs 云端","初级","base"),
("localhost & Ports","localhost 与端口","初级","base"),
("URL","网址 (URL)","初级","base"),
("HTTP vs HTTPS","HTTP 与 HTTPS","初级","base"),
("Client & Server","客户端与服务端","初级","base"),
("Database","数据库是什么","初级","base"),
("API","API 接口","初级","base"),
("JSON","JSON 数据格式","初级","base"),
("Programming Language","编程语言","初级","base"),
("Framework","框架","初级","base"),
("Library / Package","库 / 包","初级","base"),
("Package Manager","包管理器 (npm / pip)","初级","base"),
("Dependencies","依赖","初级","base"),
("Environment Variables","环境变量","初级","base"),
("Open Source & License","开源与许可证","初级","base"),
("Bug & Debugging","Bug 与调试","初级","base"),
("Error Message & Stack Trace","报错信息与堆栈","初级","base"),
("HTML / CSS / JavaScript","网页三件套 HTML / CSS / JS","初级","base"),
("Git","Git 版本管理","初级","git"),
("GitHub","GitHub","初级","git"),
("Repository","仓库 (Repo)","初级","git"),
("Commit","提交 (Commit)","初级","git"),
("Branch","分支 (Branch)","初级","git"),
("Clone / Push / Pull","克隆 / 推送 / 拉取","初级","git"),
("Pull Request","合并请求 (PR)","初级","git"),
("Merge Conflict","合并冲突","初级","git"),
("Large Language Model","大语言模型 (LLM)","初级","ai"),
("Token","Token 词元","初级","ai"),
("Context Window","上下文窗口","初级","ai"),
("Prompt","提示词 (Prompt)","初级","ai"),
("System Prompt","系统提示词","初级","ai"),
("Hallucination","AI 幻觉","初级","ai"),
("Temperature","温度 (Temperature)","初级","ai"),
("Vibe Coding","氛围编程 (Vibe Coding)","初级","ai"),
("AI Coding Assistant","AI 编程助手","初级","ai"),
("Chat vs Agent","聊天模式 vs 智能体模式","初级","ai"),
("Multimodal","多模态","初级","ai"),
("Choosing a Model","怎么选模型","初级","ai"),
("AI API Key & Billing","AI API Key 与按量计费","初级","ai"),
("Screenshot Debugging","截图 + 报错喂给 AI","初级","ai"),
# 中级
("Deployment","部署上线","中级","ship"),
("Static Hosting","静态网站托管","中级","ship"),
("Build","构建 (Build)","中级","ship"),
("Dev / Test / Prod","开发 / 测试 / 生产环境","中级","ship"),
("Docker Container","Docker 容器","中级","ship"),
("Domain & SSL","绑定域名与证书","中级","ship"),
("Unit Testing","单元测试","中级","ship"),
("End-to-End Testing","端到端测试 (E2E)","中级","ship"),
("Test-Driven Development","测试驱动开发 (TDD)","中级","ship"),
("Code Review","代码审查","中级","ship"),
("Linter & Formatter","代码检查与格式化","中级","ship"),
("TypeScript & Types","TypeScript 与类型","中级","base"),
("REST API","REST API","中级","net"),
("Authentication vs Authorization","认证 vs 授权","中级","sec"),
("Cookies & Sessions","Cookie 与会话","中级","sec"),
("Backend as a Service","后端即服务 (Supabase / Firebase)","中级","db"),
("SQL Basics","SQL 基础","中级","db"),
("CRUD","增删改查 (CRUD)","中级","db"),
("Webhook","Webhook 回调","中级","net"),
("Rate Limiting","限流","中级","net"),
("Context Engineering","上下文工程","中级","ai"),
("Rules Files","规则文件 (AGENTS.md / CLAUDE.md)","中级","ai"),
("Few-Shot Prompting","少样本提示 (Few-shot)","中级","ai"),
("Reasoning Models","推理模型与思维链","中级","ai"),
("Structured Output","结构化输出","中级","ai"),
("Tool / Function Calling","工具调用 (Function Calling)","中级","ai"),
("Embeddings","向量嵌入 (Embedding)","中级","ai"),
("RAG","检索增强生成 (RAG)","中级","ai"),
("Vector Database","向量数据库","中级","ai"),
("MCP","模型上下文协议 (MCP)","中级","ai"),
("AI Agent","AI 智能体 (Agent)","中级","ai"),
("Plan Before Code","先规划后写码 (Plan 模式)","中级","ai"),
("Checkpoints & Undo","检查点与撤回","中级","ai"),
("Prompt Injection","提示词注入","中级","ai"),
("Streaming Output","流式输出","中级","ai"),
# 高级
("Monolith vs Microservices","单体 vs 微服务","高级","dist"),
("CI/CD","持续集成 / 持续交付 (CI/CD)","高级","devops"),
("Kubernetes","Kubernetes (K8s)","高级","devops"),
("Load Balancer","负载均衡","高级","net"),
("Reverse Proxy","反向代理 (Nginx)","高级","net"),
("Message Queue","消息队列","高级","cache"),
("Multi-Agent Systems","多智能体协作","高级","ai"),
("Subagents","子代理","高级","ai"),
("Evals","AI 评测 (Evals)","高级","ai"),
("Fine-Tuning","微调 (Fine-tuning)","高级","ai"),
("Model Routing","模型路由","高级","ai"),
("Context Compaction","上下文压缩","高级","ai"),
("Agent Memory","智能体记忆","高级","ai"),
("Guardrails","护栏 (Guardrails)","高级","ai"),
("Prompt Caching","提示词缓存","高级","ai"),
("LLM Rate Limits & Cost","模型限速与成本控制","高级","ai"),
("Local Models","本地模型 (Ollama / LM Studio)","高级","ai"),
("Quantization","模型量化","高级","ai"),
("Sandbox","沙箱环境","高级","ai"),
("Human-in-the-Loop","人在回路","高级","ai"),
("Agent Skills","智能体技能 (Skills)","高级","ai"),
# 进阶
("LLM-as-a-Judge","AI 当裁判 (LLM-as-Judge)","进阶","ai"),
("LLM Observability","大模型可观测 (Tracing)","进阶","ai"),
("Benchmarks & SWE-bench","基准测试与 SWE-bench","进阶","ai"),
("RLHF","人类反馈强化学习 (RLHF)","进阶","ai"),
("Distillation","模型蒸馏","进阶","ai"),
("Parallel Agents & Worktrees","并行智能体与 Git Worktree","进阶","ai"),
("Agent Permission Security","智能体权限安全","进阶","ai"),
("Agent Harness","智能体外壳 (Harness)","进阶","ai"),
("Spec-Driven Development","规格驱动开发","进阶","ai"),
("Self-Improving Agents","自我进化的智能体","进阶","ai"),
]
def slugify(s):
    s=s.lower().replace('&',' and ').replace('+',' plus ')
    s=re.sub(r'[^a-z0-9]+','-',s).strip('-'); return s
out=[];seen=set()
for en,zh,lv,cat in NEW:
    out.append(dict(en=en,zh=zh,level=lv,cat=cat))
for r in orig:
    out.append(dict(en=r[1],zh=r[2],level=lvl(r[0]),cat=r[3],orig_analogy=r[4],orig_oops=r[5]))
order={'初级':0,'中级':1,'高级':2,'进阶':3}
catorder=['ai','base','git','ship','sec','db','net','cache','dist','sre','devops']
out.sort(key=lambda c:(order[c['level']],catorder.index(c['cat'])))
for i,c in enumerate(out):
    s=slugify(c['en'])
    while s in seen: s+='-2'
    seen.add(s); c['slug']=s; c['no']=i+1
json.dump(out,open('master.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
from collections import Counter
print(len(out),Counter(c['level'] for c in out))
