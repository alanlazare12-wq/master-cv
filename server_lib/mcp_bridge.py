from __future__ import annotations
import json, socket, threading, time, uuid

MAX_MCP_BODY=2*1024*1024
MCP_PROTOCOL_VERSION="2026-07-28"
MCP_SUPPORTED_VERSIONS=(MCP_PROTOCOL_VERSION,"2025-11-25","2025-06-18","2025-03-26")
MCP_LEGACY_DEFAULT_VERSION="2025-11-25"
PRAXISNODE_DEFAULT_MCP_ENDPOINT="http://127.0.0.1:47321/mcp"
PRAXISNODE_DEFAULT_TUNNEL_PROFILE="praxisnode"
_LOCK=threading.RLock()
_STATE={"enabled":False,"snapshot":None,"updatedAt":0,"tabId":"","mode":"read","pending":[],"lastMcpAt":0}
_EXCLUDED={"photo","versions","autoVersions","workbench","evidenceVault","reviewThreads","collaboration","sourceAudit"}
_EDIT_SCALAR_PATHS={
    "title","summary","locale.language","locale.country",
    "basics.fullName","basics.headline","basics.email","basics.phone","basics.location","basics.linkedin","basics.website",
    "settings.templateId","settings.layout","settings.density","settings.paper","settings.font","settings.accent",
    "settings.lineHeight","settings.margin","settings.headerStyle","settings.headingStyle","settings.dividerStyle","settings.contactStyle",
    "settings.photoShape","settings.photoPosition","settings.photoSize","settings.pageStrategy",
    "settings.fontScale","settings.showIcons","settings.showPhoto","target"
}
_EDIT_COLLECTIONS={"experience","education","skillGroups","projects","certifications","languages","achievements"}
_EDIT_SUBCOLLECTIONS={"experience.bullets","projects.bullets"}
_EDIT_SCHEMA={
    "operations":["set","upsert","delete"],
    "scalarPaths":sorted(_EDIT_SCALAR_PATHS),
    "collections":sorted(_EDIT_COLLECTIONS),
    "subcollections":sorted(_EDIT_SUBCOLLECTIONS),
    "rules":{
        "set":"Use path de scalarPaths y value_json con el nuevo valor JSON.",
        "upsert":"Use path de collections o subcollections, value_json con el objeto completo; item_id actualiza, vacío crea.",
        "delete":"Use path de collections o subcollections e item_id. Para experience.bullets también requiere parent_id de experiencia."
    },
    "approval":"Todas las ediciones genéricas requieren revisión/aprobación local en Hoja Personal antes de persistirse."
}

def _clean(v,depth=0):
    if depth>9:return None
    if v is None or isinstance(v,(bool,int,float)):return v
    if isinstance(v,str):return v[:30000]
    if isinstance(v,list):return [_clean(x,depth+1) for x in v[:250]]
    if isinstance(v,dict):
        out={}
        for k,val in list(v.items())[:250]:
            key=str(k)[:120]
            if key not in _EXCLUDED:out[key]=_clean(val,depth+1)
        return out
    return str(v)[:2000]

def _praxisnode_default_available():
    """Best-effort detection of the default PraxisNode MCP listener.

    A listening socket proves only that the default local MCP endpoint is reachable;
    it deliberately does not claim that PraxisNode's OpenAI tunnel is connected.
    Secondary PraxisNode instances use their own dynamically assigned ports.
    """
    try:
        with socket.create_connection(("127.0.0.1",47321),timeout=0.15):
            return True
    except OSError:
        return False

def bridge_status():
    with _LOCK:
        snap=_STATE.get("snapshot") or {};resume=snap.get("resume") or {}
        return {"available":True,"enabled":bool(_STATE.get("enabled")),"mcpEndpoint":"http://127.0.0.1:4173/mcp","protocolVersion":MCP_PROTOCOL_VERSION,"supportedProtocolVersions":list(MCP_SUPPORTED_VERSIONS),"snapshotReady":bool(resume),"resumeId":str(resume.get("id") or ""),"resumeTitle":str(resume.get("title") or ""),"updatedAt":int(_STATE.get("updatedAt") or 0),"mode":_STATE.get("mode") or "approve","pendingCount":len(_STATE.get("pending") or []),"lastMcpAt":int(_STATE.get("lastMcpAt") or 0),"praxisNodeDefaultDetected":_praxisnode_default_available(),"praxisNodeDefaultMcpEndpoint":PRAXISNODE_DEFAULT_MCP_ENDPOINT,"praxisNodeTunnelProfile":PRAXISNODE_DEFAULT_TUNNEL_PROFILE,"praxisNodeDetectionScope":"default-instance-local-mcp-only","writePolicy":"local-approval-required"}

def bridge_sync(body):
    if not isinstance(body,dict):raise ValueError("Snapshot MCP inválido.")
    resume=body.get("resume")
    if not isinstance(resume,dict):raise ValueError("Falta el CV actual para sincronizar el bridge.")
    clean=_clean(resume);rid=str(clean.get("id") or "")[:120]
    if not rid:raise ValueError("El CV sincronizado no tiene ID.")
    try:score=max(0,min(100,int(body.get("atsScore") or 0)))
    except (TypeError,ValueError):score=0
    snap={"resume":clean,"atsText":str(body.get("atsText") or "")[:120000],"atsScore":score,"jobMatch":_clean(body.get("jobMatch")),"syncedAt":int(time.time()*1000)}
    with _LOCK:
        _STATE["pending"]=[item for item in (_STATE.get("pending") or []) if str(item.get("resumeId") or "")==rid]
        _STATE["enabled"]=True;_STATE["snapshot"]=snap;_STATE["updatedAt"]=snap["syncedAt"];_STATE["tabId"]=str(body.get("tabId") or "")[:120];_STATE["mode"]="read" if body.get("mode")=="read" else "approve"
    return bridge_status()

def bridge_disable():
    with _LOCK:
        _STATE["enabled"]=False;_STATE["snapshot"]=None;_STATE["updatedAt"]=0;_STATE["tabId"]="";_STATE["pending"]=[]
    return bridge_status()

def bridge_pending():
    with _LOCK:return _clean(_STATE.get("pending") or [])

def bridge_resolve(body):
    if not isinstance(body,dict):raise ValueError("Resolución inválida.")
    aid=str(body.get("id") or "");resolution=str(body.get("resolution") or "")
    if resolution not in {"applied","rejected","dismissed"}:raise ValueError("Resolución MCP no permitida.")
    with _LOCK:
        pending=_STATE.get("pending") or []
        if not any(x.get("id")==aid for x in pending):raise ValueError("La propuesta MCP ya no existe.")
        _STATE["pending"]=[x for x in pending if x.get("id")!=aid]
    return {"ok":True,"id":aid,"resolution":resolution}

def _find_bullet(resume,bid):
    for exp in resume.get("experience") or []:
        if not isinstance(exp,dict):continue
        for bullet in exp.get("bullets") or []:
            if isinstance(bullet,dict) and str(bullet.get("id") or "")==bid:return bullet
    return None

def bridge_edit_schema():
    return _clean(_EDIT_SCHEMA)

def _parse_edit_value(raw):
    if not isinstance(raw,str) or len(raw)>120000:raise ValueError("value_json inválido o demasiado grande.")
    try:return json.loads(raw)
    except json.JSONDecodeError as exc:raise ValueError("value_json debe contener JSON válido.") from exc

def _collection_item(resume,path,item_id,parent_id=""):
    if path in {"experience.bullets","projects.bullets"}:
        parent_collection="experience" if path.startswith("experience") else "projects"
        for parent in resume.get(parent_collection) or []:
            if isinstance(parent,dict) and str(parent.get("id") or "")==parent_id:
                for item in parent.get("bullets") or []:
                    if isinstance(item,dict) and str(item.get("id") or "")==item_id:return _clean(item)
        return None
    for item in resume.get(path) or []:
        if isinstance(item,dict) and str(item.get("id") or "")==item_id:return _clean(item)
    return None

def _scalar_value(resume,path):
    cur=resume
    for part in path.split('.'):
        if not isinstance(cur,dict):return None
        cur=cur.get(part)
    return _clean(cur)

def _validate_edit_payload(path,value):
    if path=="target":
        if value is not None and not isinstance(value,dict):raise ValueError("target debe ser objeto o null.")
        return _clean(value)
    if path in _EDIT_SCALAR_PATHS:
        if path in {"settings.showIcons","settings.showPhoto"}:
            if not isinstance(value,bool):raise ValueError(f"{path} debe ser booleano.")
            return value
        if path=="settings.fontScale":
            if not isinstance(value,(int,float)) or isinstance(value,bool):raise ValueError("settings.fontScale debe ser numérico.")
            return max(.85,min(1.12,float(value)))
        if not isinstance(value,str):raise ValueError(f"{path} debe ser texto.")
        if len(value)>30000:raise ValueError("El valor supera el límite permitido.")
        if path.startswith("settings.") and len(value)>120:raise ValueError("Valor de diseño inválido.")
        enums={
          "settings.layout":{"single","dual"},"settings.density":{"airy","comfortable","compact"},"settings.paper":{"a4","letter"},
          "settings.lineHeight":{"compact","normal","relaxed"},"settings.margin":{"wide","normal","narrow"},
          "settings.headerStyle":{"line","band","minimal","centered"},"settings.headingStyle":{"line","caps","pill","plain"},
          "settings.dividerStyle":{"solid","light","none"},"settings.contactStyle":{"inline","stacked"},
          "settings.photoShape":{"circle","rounded","square"},"settings.photoPosition":{"left","right","center","sidebar"},
          "settings.photoSize":{"small","medium","large"},"settings.pageStrategy":{"auto","one","two"}
        }
        if path in enums and value not in enums[path]:raise ValueError(f"Valor no permitido para {path}.")
        if path=="settings.accent" and (len(value)!=7 or not value.startswith('#') or any(c not in '0123456789abcdefABCDEF' for c in value[1:])):raise ValueError("settings.accent debe usar formato #RRGGBB.")
        if path=="settings.templateId" and (not value or len(value)>80 or any(c not in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-' for c in value)):raise ValueError("settings.templateId inválido.")
        return value
    if path in _EDIT_COLLECTIONS or path in _EDIT_SUBCOLLECTIONS:
        if not isinstance(value,dict):raise ValueError("La operación requiere un objeto JSON.")
        clean=_clean(value)
        if path in {"experience.bullets","projects.bullets"}:
            allowed={"id","text"}
        else:
            allowed={
              "experience":{"id","company","title","location","startDate","endDate","current","bullets"},
              "education":{"id","institution","degree","startDate","endDate","details"},
              "skillGroups":{"id","name","skills"},
              "projects":{"id","name","role","url","startDate","endDate","description","bullets"},
              "certifications":{"id","name","issuer","date","url"},
              "languages":{"id","language","level"},
              "achievements":{"id","title","date","description"}
            }.get(path,set())
        unknown=set(clean)-allowed
        if unknown:raise ValueError("Campos no permitidos: "+", ".join(sorted(unknown)))
        return clean
    raise ValueError("Ruta de edición no permitida.")

def _queue_edit(args):
    if not isinstance(args,dict):raise ValueError("Edición inválida.")
    op=str(args.get("op") or "").strip();path=str(args.get("path") or "").strip();item_id=str(args.get("item_id") or "")[:120];parent_id=str(args.get("parent_id") or "")[:120]
    reason=str(args.get("reason") or "")[:2000]
    if op not in {"set","upsert","delete"}:raise ValueError("Operación de edición no permitida.")
    with _LOCK:
        if not _STATE.get("enabled"):raise ValueError("El bridge de Hoja Personal está desactivado.")
        if _STATE.get("mode")!="approve":raise ValueError("El bridge está en modo Solo lectura.")
        resume=(_STATE.get("snapshot") or {}).get("resume") or {}
        if not resume:raise ValueError("No hay CV sincronizado.")
        if op=="set":
            if path not in _EDIT_SCALAR_PATHS:raise ValueError("Ruta set no permitida.")
            value=_validate_edit_payload(path,_parse_edit_value(args.get("value_json","")))
            before=_scalar_value(resume,path);after=value
        elif op=="upsert":
            if path not in _EDIT_COLLECTIONS|_EDIT_SUBCOLLECTIONS:raise ValueError("Colección no permitida.")
            if path in {"experience.bullets","projects.bullets"} and not parent_id:raise ValueError("parent_id del elemento padre requerido para bullets.")
            value=_validate_edit_payload(path,_parse_edit_value(args.get("value_json","")))
            if item_id:value["id"]=item_id
            before=_collection_item(resume,path,item_id,parent_id) if item_id else None;after=value
        else:
            if path not in _EDIT_COLLECTIONS|_EDIT_SUBCOLLECTIONS:raise ValueError("Colección no permitida.")
            if not item_id:raise ValueError("item_id requerido para eliminar.")
            if path in {"experience.bullets","projects.bullets"} and not parent_id:raise ValueError("parent_id del elemento padre requerido para bullets.")
            before=_collection_item(resume,path,item_id,parent_id)
            if before is None:raise ValueError("El elemento a eliminar no existe en el snapshot actual.")
            after=None
        item={"id":"mcp_"+uuid.uuid4().hex,"kind":"edit","op":op,"path":path,"resumeId":str(resume.get("id") or ""),"itemId":item_id,"parentId":parent_id,"before":_clean(before),"after":_clean(after),"reason":reason,"createdAt":int(time.time()*1000),"source":"chatgpt-web","status":"pending"}
        _STATE.setdefault("pending",[]).append(item);_STATE["pending"]=_STATE["pending"][-80:]
        return _clean(item)

def _queue(kind,after,reason="",bullet_id=""):
    with _LOCK:
        if not _STATE.get("enabled"):raise ValueError("El bridge de Hoja Personal está desactivado.")
        if _STATE.get("mode")!="approve":raise ValueError("El bridge está en modo Solo lectura.")
        snap=_STATE.get("snapshot") or {};resume=snap.get("resume") or {}
        if not resume:raise ValueError("Hoja Personal todavía no sincronizó un CV con el bridge.")
        rid=str(resume.get("id") or "")
        if kind=="summary":before=str(resume.get("summary") or "")
        elif kind=="bullet":
            bullet=_find_bullet(resume,bullet_id)
            if not bullet:raise ValueError("El bullet indicado no existe en el snapshot actual.")
            before=str(bullet.get("text") or "")
        else:raise ValueError("Tipo de propuesta no permitido.")
        replacement=str(after or "").strip()
        if not replacement:raise ValueError("La propuesta está vacía.")
        if len(replacement)>30000:raise ValueError("La propuesta supera el límite de 30,000 caracteres.")
        item={"id":"mcp_"+uuid.uuid4().hex,"kind":kind,"resumeId":rid,"before":before,"after":replacement,"reason":str(reason or "")[:2000],"bulletId":bullet_id[:120] if bullet_id else "","createdAt":int(time.time()*1000),"source":"chatgpt-web","status":"pending"}
        _STATE.setdefault("pending",[]).append(item);_STATE["pending"]=_STATE["pending"][-80:]
        return _clean(item)

def _tools():
    tools=[
      {"name":"cv_get_current","description":"Lee el CV actualmente abierto en Hoja Personal. El snapshot omite foto, historiales y blobs locales.","inputSchema":{"type":"object","properties":{},"additionalProperties":False},"annotations":{"readOnlyHint":True,"destructiveHint":False,"idempotentHint":True}},
      {"name":"cv_get_bridge_status","description":"Consulta estado del bridge, modo de permisos, sincronización y propuestas pendientes.","inputSchema":{"type":"object","properties":{},"additionalProperties":False},"annotations":{"readOnlyHint":True,"destructiveHint":False,"idempotentHint":True}},
      {"name":"cv_get_edit_schema","description":"Devuelve las rutas y operaciones permitidas para edición remota segura del CV.","inputSchema":{"type":"object","properties":{},"additionalProperties":False},"annotations":{"readOnlyHint":True,"destructiveHint":False,"idempotentHint":True}}
    ]
    with _LOCK:mode=_STATE.get("mode") or "approve"
    if mode=="approve":tools.extend([
      {"name":"cv_propose_summary_update","description":"Propone reemplazar el perfil profesional. No modifica el CV: queda pendiente de auditoría factual y aprobación local en Hoja Personal.","inputSchema":{"type":"object","properties":{"summary":{"type":"string","minLength":1,"maxLength":30000},"reason":{"type":"string","maxLength":2000}},"required":["summary"],"additionalProperties":False},"annotations":{"readOnlyHint":False,"destructiveHint":False,"idempotentHint":False}},
      {"name":"cv_propose_bullet_update","description":"Propone reemplazar un bullet de experiencia por ID. No modifica el CV: queda pendiente de auditoría factual y aprobación local.","inputSchema":{"type":"object","properties":{"bullet_id":{"type":"string","minLength":1,"maxLength":120},"text":{"type":"string","minLength":1,"maxLength":30000},"reason":{"type":"string","maxLength":2000}},"required":["bullet_id","text"],"additionalProperties":False},"annotations":{"readOnlyHint":False,"destructiveHint":False,"idempotentHint":False}},
      {"name":"cv_propose_edit","description":"Propone una edición estructurada del CV. Operaciones: set para campos escalares; upsert/delete para colecciones permitidas. Usa cv_get_edit_schema antes de editar. value_json debe contener JSON válido. Nunca escribe directamente: queda pendiente de aprobación local.","inputSchema":{"type":"object","properties":{"op":{"type":"string","minLength":1,"maxLength":16},"path":{"type":"string","minLength":1,"maxLength":120},"item_id":{"type":"string","maxLength":120},"parent_id":{"type":"string","maxLength":120},"value_json":{"type":"string","maxLength":120000},"reason":{"type":"string","maxLength":2000}},"required":["op","path"],"additionalProperties":False},"annotations":{"readOnlyHint":False,"destructiveHint":False,"idempotentHint":False}}
    ])
    return tools

def _result(payload,is_error=False):
    clean=_clean(payload);text=json.dumps(clean,ensure_ascii=False,separators=(",",":"))
    return {"content":[{"type":"text","text":text}],"structuredContent":clean,"isError":bool(is_error)}

def _call_tool(name,args):
    with _LOCK:_STATE["lastMcpAt"]=int(time.time()*1000)
    if name=="cv_get_bridge_status":return _result(bridge_status())
    if name=="cv_get_edit_schema":return _result(bridge_edit_schema())
    if name=="cv_get_current":
        with _LOCK:
            if not _STATE.get("enabled"):return _result({"error":"El bridge de Hoja Personal está desactivado."},True)
            snap=_clean(_STATE.get("snapshot"))
        return _result(snap) if snap else _result({"error":"No hay un CV sincronizado. Abre Hoja Personal en el navegador."},True)
    if name=="cv_propose_summary_update":
        try:return _result({"queued":True,"proposal":_queue("summary",args.get("summary"),args.get("reason",""))})
        except ValueError as exc:return _result({"error":str(exc)},True)
    if name=="cv_propose_bullet_update":
        try:return _result({"queued":True,"proposal":_queue("bullet",args.get("text"),args.get("reason",""),str(args.get("bullet_id") or ""))})
        except ValueError as exc:return _result({"error":str(exc)},True)
    if name=="cv_propose_edit":
        try:return _result({"queued":True,"proposal":_queue_edit(args)})
        except ValueError as exc:return _result({"error":str(exc)},True)
    return _result({"error":f"Herramienta MCP desconocida: {name}"},True)

_MCP_INSTRUCTIONS="Lee el CV con cv_get_current. Las herramientas cv_propose_* nunca escriben directamente: crean propuestas que el usuario debe revisar y aprobar localmente."

def _rpc_error(rid,code,message,data=None):
    error={"code":code,"message":message}
    if data is not None:error["data"]=data
    return {"jsonrpc":"2.0","id":rid,"error":error}

def _header(headers,name):
    if headers is None:return ""
    try:return str(headers.get(name) or headers.get(name.lower()) or "")
    except (AttributeError,TypeError):return ""

def _server_meta(app_version):
    return {"io.modelcontextprotocol/serverInfo":{"name":"hoja-personal-cv-studio","version":app_version}}

def _modern_protocol_error(params):
    meta=params.get("_meta") if isinstance(params,dict) else None
    if not isinstance(meta,dict):return (-32602,"Missing required MCP request _meta.",None)
    version=meta.get("io.modelcontextprotocol/protocolVersion")
    if not isinstance(version,str):return (-32602,"Missing MCP protocol version metadata.",None)
    if version!=MCP_PROTOCOL_VERSION:return (-32022,"Unsupported protocol version",{"supported":[MCP_PROTOCOL_VERSION],"requested":version})
    info=meta.get("io.modelcontextprotocol/clientInfo")
    if info is not None and (not isinstance(info,dict) or not isinstance(info.get("name"),str) or not isinstance(info.get("version"),str)):
        return (-32602,"Invalid MCP clientInfo metadata.",None)
    capabilities=meta.get("io.modelcontextprotocol/clientCapabilities")
    if not isinstance(capabilities,dict):return (-32602,"Missing MCP clientCapabilities metadata.",None)
    return None

def _modern_result(payload,app_version):
    out=dict(payload);out.setdefault("resultType","complete");out["_meta"]=_server_meta(app_version);return out

def mcp_response_protocol(message,headers=None):
    requested=_header(headers,"MCP-Protocol-Version")
    if requested in MCP_SUPPORTED_VERSIONS:return requested
    if isinstance(message,dict) and message.get("method")=="initialize":
        params=message.get("params") if isinstance(message.get("params"),dict) else {}
        version=str(params.get("protocolVersion") or "")
        if version in MCP_SUPPORTED_VERSIONS[1:]:return version
        return MCP_LEGACY_DEFAULT_VERSION
    return MCP_PROTOCOL_VERSION

def mcp_handle(message,app_version,headers=None):
    if not isinstance(message,dict) or message.get("jsonrpc")!="2.0":return _rpc_error(message.get("id") if isinstance(message,dict) else None,-32600,"Invalid Request")
    rid=message.get("id");method=str(message.get("method") or "");params=message.get("params") if isinstance(message.get("params"),dict) else {}
    requested_header=_header(headers,"MCP-Protocol-Version")
    if requested_header and requested_header not in MCP_SUPPORTED_VERSIONS:
        return _rpc_error(rid,-32022,"Unsupported protocol version",{"supported":list(MCP_SUPPORTED_VERSIONS),"requested":requested_header})
    if method=="initialize":
        requested=str(params.get("protocolVersion") or "")
        protocol=requested if requested in MCP_SUPPORTED_VERSIONS[1:] else MCP_LEGACY_DEFAULT_VERSION
        return {"jsonrpc":"2.0","id":rid,"result":{"protocolVersion":protocol,"capabilities":{"tools":{"listChanged":False}},"serverInfo":{"name":"hoja-personal-cv-studio","version":app_version},"instructions":_MCP_INSTRUCTIONS}}
    if method in {"notifications/initialized","notifications/cancelled"}:return None
    meta=params.get("_meta") if isinstance(params,dict) else None
    meta_version=meta.get("io.modelcontextprotocol/protocolVersion") if isinstance(meta,dict) else ""
    modern=requested_header==MCP_PROTOCOL_VERSION or meta_version==MCP_PROTOCOL_VERSION or method=="server/discover"
    if modern:
        transport_method=_header(headers,"Mcp-Method")
        if headers is not None and not transport_method:return _rpc_error(rid,-32602,"Missing required Mcp-Method header.")
        if transport_method and transport_method!=method:return _rpc_error(rid,-32602,"Mcp-Method header does not match JSON-RPC method.")
        rpc_name=str(params.get("name") or "") if method=="tools/call" else ""
        transport_name=_header(headers,"Mcp-Name")
        if headers is not None and rpc_name and not transport_name:return _rpc_error(rid,-32602,"Missing required Mcp-Name header.")
        if transport_name and transport_name!=rpc_name:return _rpc_error(rid,-32602,"Mcp-Name header does not match tools/call name.")
        protocol_error=_modern_protocol_error(params)
        if protocol_error:
            code,message_text,data=protocol_error;return _rpc_error(rid,code,message_text,data)
    if method=="server/discover":
        return {"jsonrpc":"2.0","id":rid,"result":_modern_result({"supportedVersions":[MCP_PROTOCOL_VERSION],"capabilities":{"tools":{"listChanged":False}},"instructions":_MCP_INSTRUCTIONS,"ttlMs":0,"cacheScope":"private"},app_version)}
    if method=="ping" and not modern:return {"jsonrpc":"2.0","id":rid,"result":{}}
    if method=="tools/list":
        result={"tools":_tools()}
        if modern:result=_modern_result({**result,"ttlMs":0,"cacheScope":"private"},app_version)
        return {"jsonrpc":"2.0","id":rid,"result":result}
    if method=="tools/call":
        name=str(params.get("name") or "");args=params.get("arguments") if isinstance(params.get("arguments"),dict) else {}
        result=_call_tool(name,args)
        if modern:result=_modern_result(result,app_version)
        return {"jsonrpc":"2.0","id":rid,"result":result}
    return _rpc_error(rid,-32601,f"Method not found: {method}")
