import re, unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

class ContractTests(unittest.TestCase):
    def test_pwa_assets_exist(self):
        for p in ['index.html','styles.css','sw.js','manifest.webmanifest','src/app.js','src/storage.js','src/conflict-resolver.js','src/personal-templates.js','src/studio-engine.js','src/studio-pro.js','src/local-premium.js','src/template-forge.js','src/local-ai.js','src/resume-workbench.js','run.bat','server.py']:
            self.assertTrue((ROOT/p).exists(),p)

    def test_service_worker_cache_contract(self):
        sw=(ROOT/'sw.js').read_text(encoding='utf8')
        self.assertIn('hoja-personal-v48',sw);self.assertIn("url.pathname.startsWith('/api/')",sw)
        for rel in re.findall(r"'([^']+)'",sw.split('const FILES=',1)[1].split('];',1)[0]):
            if rel=='./': continue
            rel=rel.split('?',1)[0].lstrip('./')
            self.assertTrue((ROOT/rel).exists(),rel)

    def test_no_saas_runtime_in_personal_package(self):
        for p in ['server_fastapi.py','worker.py','docker-compose.yml','docker-compose.production.yml','migrate.py','platform_store.py']:
            self.assertFalse((ROOT/p).exists(),p)

    def test_identity_is_personal_v42(self):
        html=(ROOT/'index.html').read_text(encoding='utf8')
        self.assertIn('Hoja Personal',html);self.assertIn('100% local',html);self.assertIn('528',html);self.assertIn('Studio Pro',html);self.assertNotIn('Organizaciones',html);self.assertRegex(html,r'styles\.css\?v=48(?:-mcp\d+)?');self.assertRegex(html,r'src/app\.js\?v=48(?:-mcp\d+)?')

    def test_v28_workbench_local_ai_and_forge_contract(self):
        html=(ROOT/'index.html').read_text(encoding='utf8');app=(ROOT/'src/app.js').read_text(encoding='utf8');server=(ROOT/'server.py').read_text(encoding='utf8')
        self.assertIn('Copiloto IA',html);self.assertIn('Aplicar tras revisar',app);self.assertIn("audit.status==='verified'",app);self.assertIn('Template Forge',app);self.assertIn('local-ai.js',app);self.assertIn('resume-workbench.js',app);self.assertIn('storage.js',app);self.assertIn('migrateLegacy',app);self.assertIn('sw.js?v=48',app);self.assertNotIn('localStorage.setItem',app);self.assertIn('Release Gate',app);self.assertIn('Resume Test Lab',app);self.assertIn('/api/local-ai/status',server);self.assertIn('/api/local-ai/suggest',server);self.assertIn('127.0.0.1:11434',server);self.assertNotIn('api.openai.com',server)


    def test_v42_photo_templates_and_local_ai_builder_contract(self):
        html=(ROOT/'index.html').read_text(encoding='utf8');app=(ROOT/'src/app.js').read_text(encoding='utf8');server=(ROOT/'server.py').read_text(encoding='utf8');templates=(ROOT/'src/personal-templates.js').read_text(encoding='utf8');schema=(ROOT/'src/schema.js').read_text(encoding='utf8')
        self.assertIn('Crear con IA',html);self.assertIn('id="aicreator"',html);self.assertIn('/api/local-ai/build-resume',server);self.assertIn('_builder_resume_schema',server);self.assertIn('vision_input',server)
        self.assertIn("category:'Con foto'",templates);self.assertIn('photoFriendly',templates);self.assertIn('cleanPhotoDataUrl',schema);self.assertIn('optimizeProfilePhoto',app);self.assertIn('aiCreateFile',app)


    def test_v43_release_identity_matches_launchers(self):
        package=(ROOT/'package.json').read_text(encoding='utf8');server=(ROOT/'server.py').read_text(encoding='utf8');bat=(ROOT/'run.bat').read_text(encoding='utf8');manifest=(ROOT/'manifest.webmanifest').read_text(encoding='utf8')
        self.assertIn('48.0.0-personal',package);self.assertIn("VERSION='48.0.0-personal'",server);self.assertIn('CV Studio v48',bat);self.assertNotIn('CV Studio v37',bat);self.assertIn('CV Studio v48',manifest)

    def test_v48_conflict_resolution_contract(self):
        html=(ROOT/'index.html').read_text(encoding='utf8');app=(ROOT/'src/app.js').read_text(encoding='utf8');resolver=(ROOT/'src/conflict-resolver.js').read_text(encoding='utf8');sw=(ROOT/'sw.js').read_text(encoding='utf8')
        self.assertIn('id="tabConflictFork"',html);self.assertIn('Conservar ambos',html);self.assertIn('Usar mi versión',html)
        self.assertIn("resolveTabConflict('fork')",app);self.assertIn("resolveTabConflict('replace')",app);self.assertIn('resolveConflictState',resolver);self.assertIn('conflict-resolver.js?v=48',sw)

    def test_csp_stays_self_only(self):
        server=(ROOT/'server.py').read_text(encoding='utf8')
        self.assertIn("connect-src 'self'",server);self.assertNotIn('connect-src http://127.0.0.1:11434',server)


class FactualRelationTests(unittest.TestCase):
    def test_v28_server_blocks_recombined_claims(self):
        import server
        before='Product Designer con seis años creando productos digitales.'
        after='Product Designer con seis años creando productos digitales. Lideré equipos internacionales.'
        self.assertTrue(server._unsupported_positive_evidence(before,after) or server._unsupported_relational_claims(before,after))



class FactualPolarityMetricTests(unittest.TestCase):
    def test_v28_server_preserves_negation_polarity(self):
        import server
        cases=[
            ('No lideré equipos internacionales.','Lideré equipos internacionales.'),
            ('Sin experiencia gestionando equipos globales.','Experiencia gestionando equipos globales.'),
            ('Nunca administré infraestructura cloud.','Administré infraestructura cloud.'),
            ('I did not lead international teams.','I led international teams.'),
            ("I didn't lead international teams.",'I led international teams.'),
            ('Ni lideré equipos internacionales ni administré cloud.','Lideré equipos internacionales.'),
        ]
        for before,after in cases:self.assertTrue(server._unsupported_polarity_claims(before,after),(before,after))

    def test_v28_server_binds_metrics_and_dates_to_claims(self):
        import server
        cases=[
            ('Aumenté ventas 20% y reduje costos 10%.','Aumenté ventas 10% y reduje costos 20%.'),
            ('Atendí 50 clientes y cerré 12 contratos.','Atendí 12 clientes y cerré 50 contratos.'),
            ('Gestioné 3 proyectos en México y 8 proyectos en España.','Gestioné 8 proyectos en México y 3 proyectos en España.'),
            ('Trabajé de 2018 a 2022.','Trabajé de 2022 a 2018.'),
            ('Atendí diez clientes y cerré doce contratos.','Atendí doce clientes y cerré diez contratos.'),
            ('Aumenté ventas +20%.','Aumenté ventas -20%.'),
        ]
        for before,after in cases:self.assertTrue(server._unsupported_metric_bindings(before,after),(before,after))

class FactualDirectionalRelationTests(unittest.TestCase):
    def test_v28_server_preserves_directional_relations(self):
        import server
        cases=[
            ('Ana supervisó a Carlos.','Carlos supervisó a Ana.'),
            ('Diseñé para México con un equipo de España.','Diseñé para España con un equipo de México.'),
            ('Migré datos de Oracle a PostgreSQL.','Migré datos de PostgreSQL a Oracle.'),
            ('El proyecto A reemplazó al proyecto B.','El proyecto B reemplazó al proyecto A.'),
        ]
        for before,after in cases:
            self.assertTrue(server._unsupported_relational_claims(before,after),(before,after))

    def test_v28_server_allows_direction_preserving_simplification(self):
        import server
        cases=[
            ('Ana supervisó directamente a Carlos durante el proyecto.','Ana supervisó a Carlos.'),
            ('Migré datos de Oracle a PostgreSQL durante la modernización.','Migré datos de Oracle a PostgreSQL.'),
        ]
        for before,after in cases:
            self.assertFalse(server._unsupported_relational_claims(before,after),(before,after))

class V28ReleaseMetadataTests(unittest.TestCase):
    def test_v40_asset_cache_busters_and_backup_metadata(self):
        html=(ROOT/'index.html').read_text(encoding='utf8')
        app=(ROOT/'src/app.js').read_text(encoding='utf8')
        sw=(ROOT/'sw.js').read_text(encoding='utf8')
        self.assertIn('styles.css?v=48',html)
        self.assertIn('src/app.js?v=48',html)
        self.assertIn("sw.js?v=48",app)
        self.assertIn("hoja-personal-v48",sw)
        self.assertIn("styles.css?v=48",sw)
        self.assertIn("src/app.js?v=48",sw)
        self.assertIn('`hoja-personal-v${APP_MAJOR}-backup.json`',app);self.assertIn('legacyStorageKeys()',app)
        self.assertIn("version:APP_MAJOR",app)
        self.assertIn("const STORE=storageKey(), LEGACY_STORES=legacyStorageKeys()",app)


class V28RelationalMarkersAndMetricAnchorsTests(unittest.TestCase):
    def test_v28_server_preserves_prepositional_roles(self):
        import server
        cases=[
            ('Migré datos de Oracle a PostgreSQL.','Migré datos a Oracle desde PostgreSQL.'),
            ('Transferí datos de México a España.','Transferí datos a México desde España.'),
            ('Gestioné proyectos para México desde España.','Gestioné proyectos desde México para España.'),
            ('Reporté a Ana sobre Carlos.','Reporté sobre Ana a Carlos.'),
            ('Entregué el informe a Ana de parte de Carlos.','Entregué el informe de Ana a Carlos.'),
        ]
        for before,after in cases:self.assertTrue(server._unsupported_relational_claims(before,after),(before,after))

    def test_v28_server_binds_metrics_to_discriminative_anchors(self):
        import server
        cases=[
            ('Aumenté ventas en México 20% y aumenté ventas en España 10%.','Aumenté ventas en España 20% y aumenté ventas en México 10%.'),
            ('Reduje costos de Oracle 20% y reduje costos de PostgreSQL 10%.','Reduje costos de PostgreSQL 20% y reduje costos de Oracle 10%.'),
        ]
        for before,after in cases:self.assertTrue(server._unsupported_metric_bindings(before,after),(before,after))

    def test_v28_server_allows_metric_simplification_with_same_anchors(self):
        import server
        self.assertFalse(server._unsupported_metric_bindings('Aumenté las ventas en México 20% durante el primer trimestre.','Aumenté ventas en México 20%.'))

class V28CompleteAssetVersioningTests(unittest.TestCase):
    def test_v40_all_es_modules_and_cached_assets_are_versioned(self):
        import re
        html=(ROOT/'index.html').read_text(encoding='utf8')
        app=(ROOT/'src/app.js').read_text(encoding='utf8')
        sw=(ROOT/'sw.js').read_text(encoding='utf8')
        self.assertRegex(html,r'styles\.css\?v=48(?:-mcp\d+)?');self.assertRegex(html,r'src/app\.js\?v=48(?:-mcp\d+)?');self.assertIn('manifest.webmanifest?v=48',html)
        self.assertIn("sw.js?v=48",app);self.assertIn("hoja-personal-v48",sw);self.assertIn("manifest.webmanifest?v=48",sw)
        for path in (ROOT/'src').glob('*.js'):
            text=path.read_text(encoding='utf8')
            for spec in re.findall(r"from\s+['\"](\./[^'\"]+\.js(?:\?v=\d+)?)['\"]",text):
                self.assertTrue(spec.endswith('?v=48'),f'{path.name}: {spec}')
        cached=re.findall(r"['\"](\./src/[^'\"]+\.js(?:\?v=\d+)?)['\"]",sw)
        self.assertTrue(cached)
        self.assertTrue(all(x.endswith('?v=48') for x in cached),cached)

    def test_v40_server_header_and_backup_metadata(self):
        server=(ROOT/'server.py').read_text(encoding='utf8')
        app=(ROOT/'src/app.js').read_text(encoding='utf8')
        self.assertIn("server_version='HojaPersonal/48'",server)
        self.assertIn("VERSION='48.0.0-personal'",server)
        self.assertIn('`hoja-personal-v${APP_MAJOR}-backup.json`',app)
        self.assertIn("version:APP_MAJOR",app)
        self.assertIn("const STORE=storageKey(), LEGACY_STORES=legacyStorageKeys()",app)


class V29HardeningContractTests(unittest.TestCase):
    def test_v29_schema_normalizes_target_requirements(self):
        schema=(ROOT/'src/schema.js').read_text(encoding='utf-8')
        self.assertIn('const cleanTarget=',schema);self.assertIn('target:cleanTarget(r.target)',schema);self.assertIn('const target=cleanTarget(t.target)',schema)
    def test_v29_finalize_restores_storage_when_on_success_throws(self):
        app=(ROOT/'src/app.js').read_text(encoding='utf-8')
        self.assertIn('const stored=captureStorage(localStorage,[STORE,JOURNAL])',app);self.assertIn('restoreStorage(localStorage,stored)',app);self.assertNotIn('captureStorage(localStorage,[STORE,JOURNAL,SYNC_INDEX]',app)

class V32PartitiveScopeTests(unittest.TestCase):
    def test_v32_server_blocks_scope_elevation_from_part_to_whole(self):
        import server
        cases=[
            ('Lideré un workstream dentro del proyecto Atlas.','Lideré el proyecto Atlas.'),
            ('Gestioné un subconjunto del equipo de producto.','Gestioné el equipo de producto.'),
            ('Gestioné algunos miembros del equipo de producto.','Gestioné el equipo de producto.'),
            ('Fui responsable de la parte frontend de la migración.','Fui responsable de la migración.'),
            ('Dirigí una fase del programa internacional.','Dirigí el programa internacional.'),
            ('Owned the frontend portion of the migration.','Owned the migration.'),
            ('Managed a subset of the product team.','Managed the product team.'),
            ('Led one phase of the international program.','Led the international program.'),
        ]
        for before,after in cases:self.assertTrue(server._unsupported_constraint_claims(before,after),(before,after))

    def test_v32_server_allows_scope_preserving_simplification(self):
        import server
        self.assertFalse(server._unsupported_constraint_claims('Lideré un workstream dentro del proyecto Atlas durante 2025.','Lideré un workstream dentro del proyecto Atlas.'))

class V32MembershipAndSupportScopeTests(unittest.TestCase):
    def test_v32_server_blocks_membership_or_support_elevation(self):
        import server
        cases=[
            ('Fui miembro del equipo responsable de seguridad.','Fui responsable de seguridad.'),
            ('I was a member of the team responsible for security.','I was responsible for security.'),
            ('Fui responsable de apoyar la migración a PostgreSQL.','Fui responsable de la migración a PostgreSQL.'),
            ('I was responsible for supporting the PostgreSQL migration.','I was responsible for the PostgreSQL migration.'),
        ]
        for before,after in cases:self.assertTrue(server._unsupported_constraint_claims(before,after),(before,after))

class V32GeographicScopeTests(unittest.TestCase):
    def test_v32_server_blocks_geographic_scope_removal(self):
        import server
        cases=[
            ('Fui gerente regional de ventas.','Fui gerente de ventas.'),
            ('I was regional sales manager.','I was sales manager.'),
            ('Lideré el equipo de EMEA.','Lideré el equipo.'),
            ('I led the EMEA team.','I led the team.'),
        ]
        for before,after in cases:self.assertTrue(server._unsupported_constraint_claims(before,after),(before,after))

class V32NonPrimaryAndCardinalityTests(unittest.TestCase):
    def test_v32_server_blocks_nonprimary_role_and_explicit_one_removal(self):
        import server
        cases=[
            ('Fui responsable secundario del proyecto.','Fui responsable del proyecto.'),
            ('I was secondary owner of the project.','I was owner of the project.'),
            ('Fui líder de respaldo del equipo.','Fui líder del equipo.'),
            ('I was backup lead for the team.','I was lead for the team.'),
            ('Fui líder alterno del equipo.','Fui líder del equipo.'),
            ('I was alternate lead for the team.','I was lead for the team.'),
            ('Gestioné 1 región.','Gestioné regiones.'),
        ]
        for before,after in cases:self.assertTrue(server._unsupported_constraint_claims(before,after),(before,after))

class V32AdvisorAndAffiliationTests(unittest.TestCase):
    def test_v32_server_blocks_advisor_elevation_and_affiliation_change(self):
        import server
        cases=[
            ('Fui asesor del CEO.','Fui CEO.'),
            ('I was advisor to the CEO.','I was CEO.'),
            ('Fui asesor del Director.','Fui Director.'),
            ('I was consultant to the Director.','I was Director.'),
            ('Trabajé para Microsoft.','Trabajé en Microsoft.'),
            ('I worked for Microsoft.','I worked at Microsoft.'),
            ('Trabajé con Microsoft.','Trabajé en Microsoft.'),
            ('I worked with Microsoft.','I worked at Microsoft.'),
        ]
        for before,after in cases:
            self.assertTrue(server._unsupported_constraint_claims(before,after) or server._unsupported_relational_claims(before,after),(before,after))

class V32RelativeAttributionTests(unittest.TestCase):
    def test_v32_server_blocks_relative_clause_result_reassignment(self):
        import server
        cases=[
            ('I advised a team that raised $1m.','I raised $1m.'),
            ('I designed a product that generated $1m in revenue.','I generated $1m in revenue.'),
            ('I advised a team which raised $1m.','I raised $1m.'),
        ]
        for before,after in cases:self.assertTrue(server._unsupported_constraint_claims(before,after),(before,after))

class V32EmbeddedAttributionTests(unittest.TestCase):
    def test_v32_server_blocks_embedded_attribution(self):
        import server
        cases=[
            ('The project I worked on generated $1m.','I generated $1m.'),
            ('The team I advised raised $1m.','I raised $1m.'),
            ('The product where I worked generated $1m.','I generated $1m.'),
        ]
        for before,after in cases:self.assertTrue(server._unsupported_constraint_claims(before,after),(before,after))

class V32PotentialIndirectSpecificRoleTests(unittest.TestCase):
    def test_v32_server_blocks_potential_indirect_and_specific_scope_removal(self):
        import server
        cases=[
            ('Worked with prospective clients.','Worked with clients.'),
            ('Potential revenue of $1m.','Revenue of $1m.'),
            ('Posibles ingresos de $1m.','Ingresos de $1m.'),
            ('I indirectly managed the product team.','I managed the product team.'),
            ('Fui gerente matricial del equipo.','Fui gerente del equipo.'),
            ('I was a technical lead for the team.','I was lead for the team.'),
            ('Fui gerente de proyecto de Atlas.','Fui gerente de Atlas.'),
        ]
        for before,after in cases:self.assertTrue(server._unsupported_constraint_claims(before,after),(before,after))

class V32InformalAndInProgressTests(unittest.TestCase):
    def test_v32_server_blocks_informal_or_in_progress_status_removal(self):
        import server
        cases=[
            ('I was an informal lead for the team.','I was lead for the team.'),
            ('I was the unofficial lead for the team.','I was the lead for the team.'),
            ('I was de facto lead for the team.','I was lead for the team.'),
            ('Studying for PMP certification.','PMP certification.'),
            ('Pursuing PMP certification.','PMP certification.'),
            ('Preparing for AWS certification.','AWS certification.'),
            ('PMP certification in progress.','PMP certification.'),
            ('Completed coursework toward an MBA.','MBA.'),
            ('Pursuing an MBA.','MBA.'),
        ]
        for before,after in cases:self.assertTrue(server._unsupported_constraint_claims(before,after),(before,after))

class V32PendingCredentialVariantsTests(unittest.TestCase):
    def test_v32_server_blocks_pending_credential_variants(self):
        import server
        cases=[
            ('Studied for PMP certification.','PMP certification.'),
            ('On track for PMP certification.','PMP certification.'),
            ('Seeking PMP certification.','PMP certification.'),
        ]
        for before,after in cases:self.assertTrue(server._unsupported_constraint_claims(before,after),(before,after))


class V35WindowsLifecycleContractTests(unittest.TestCase):
    def test_v35_run_and_stop_use_pid_and_unique_instance_token(self):
        run=(ROOT/'run.bat').read_text(encoding='utf-8')
        stop=(ROOT/'stop.bat').read_text(encoding='utf-8')
        server=(ROOT/'server.py').read_text(encoding='utf-8')
        self.assertIn('.hoja-server.pid',run);self.assertIn('.hoja-server.token',run)
        self.assertIn('--pid-file',run);self.assertIn('--instance-token',run)
        self.assertIn('$env:PIDFILE',run);self.assertNotIn('%OLDPID%',run)
        self.assertIn('Get-CimInstance Win32_Process',stop)
        self.assertIn('server\\.py',stop);self.assertIn('INSTANCE_TOKEN',stop)
        self.assertIn('taskkill /PID',stop)
        self.assertNotIn('taskkill /IM python.exe',stop.lower())
        self.assertIn("ap.add_argument('--pid-file'",server)
        self.assertIn("ap.add_argument('--instance-token'",server)
        self.assertIn('_claim_pid_file',server);self.assertIn('_release_pid_file',server)

    def test_v35_pid_file_refuses_another_live_process_and_cleans_own_pid(self):
        import subprocess,sys,tempfile
        import server
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'server.pid'
            proc=subprocess.Popen([sys.executable,'-c','import time; time.sleep(10)'])
            try:
                path.write_text(str(proc.pid),encoding='utf-8')
                with self.assertRaises(RuntimeError):server._claim_pid_file(path)
            finally:
                proc.terminate();proc.wait(timeout=5)
            path.write_text('99999999',encoding='utf-8')
            claimed=server._claim_pid_file(path)
            self.assertEqual(path.read_text(encoding='utf-8').strip(),str(__import__('os').getpid()))
            server._release_pid_file(claimed)
            self.assertFalse(path.exists())

    @unittest.skipIf(__import__('os').name=='nt','Popen.terminate usa TerminateProcess en Windows y no ejecuta handlers de Python')
    def test_v35_server_removes_pid_file_on_sigterm(self):
        import subprocess,sys,tempfile,time,os
        with tempfile.TemporaryDirectory() as td:
            pidfile=Path(td)/'server.pid'
            proc=subprocess.Popen([sys.executable,str(ROOT/'server.py'),'--no-browser','--port','0','--pid-file',str(pidfile),'--instance-token','qa_sigterm'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            try:
                for _ in range(40):
                    if pidfile.exists():break
                    time.sleep(.05)
                self.assertTrue(pidfile.exists())
                self.assertEqual(pidfile.read_text(encoding='utf-8').strip(),str(proc.pid))
                proc.terminate();proc.wait(timeout=5)
                for _ in range(20):
                    if not pidfile.exists():break
                    time.sleep(.05)
                self.assertFalse(pidfile.exists())
            finally:
                if proc.poll() is None:
                    proc.kill();proc.wait(timeout=5)

class V36PreviewEditingContractTests(unittest.TestCase):
    def test_v39_preview_editor_has_history_context_actions_and_print_cleanup(self):
        html=(ROOT/'index.html').read_text(encoding='utf8')
        app=(ROOT/'src/app.js').read_text(encoding='utf8')
        css=(ROOT/'styles.css').read_text(encoding='utf8')
        engine=(ROOT/'src/template-engine-base.js').read_text(encoding='utf8')
        for token in ['previewUndoBtn','previewRedoBtn','previewAddSelect','previewHiddenSelect','previewEditHint']:
            self.assertIn(token,html)
        for token in ['previewHistory(','previewMutate(','applyPreviewAction(','previewSnapshot()']:
            self.assertIn(token,app)
        for token in ['data-preview-action','preview-entry-controls','preview-add','data-preview-placeholder']:
            self.assertIn(token,engine)
        self.assertIn('@media print',css);self.assertIn('.preview-editbar',css);self.assertIn('.preview-entry-controls',css)
        self.assertIn("previewMode='human';previewSurface='export';previewEditMode=false",app)

class V37PreviewVisualContractTests(unittest.TestCase):
    def test_v39_preview_visual_controls_do_not_reflow_or_overlap_by_design(self):
        app=(ROOT/'src/app.js').read_text(encoding='utf8')
        css=(ROOT/'styles.css').read_text(encoding='utf8')
        engine=(ROOT/'src/template-engine-base.js').read_text(encoding='utf8')
        self.assertIn("--preview-ui-inverse",app)
        self.assertIn("left:calc(-38px * var(--preview-ui-inverse,1))",css)
        self.assertIn("right:calc(-38px * var(--preview-ui-inverse,1))",css)
        self.assertIn(":has([data-preview-entry]:hover)>.preview-entry-controls",css)
        self.assertIn("position:absolute",css[css.index('.preview-add{'):css.index('.preview-bullet>.preview-entry-controls')])
        self.assertNotIn('preview-edit-mode:before',css)
        self.assertIn('resume-inline-entry',engine)
        self.assertIn('aria-label="${esc(label)}"',engine)

class V38PreviewDragDropContractTests(unittest.TestCase):
    def test_v39_preview_drag_handles_drop_markers_and_touch_fallback_exist(self):
        app=(ROOT/'src/app.js').read_text(encoding='utf8')
        css=(ROOT/'styles.css').read_text(encoding='utf8')
        engine=(ROOT/'src/template-engine-base.js').read_text(encoding='utf8')
        for token in ['data-preview-drag','data-preview-drag-target','preview-drag-handle','data-preview-drop-column']:
            self.assertIn(token,engine)
        for token in ['bindPreviewDrag(','commitPreviewDrag(','movePreviewBulletTo(','movePreviewSectionTo(','elementFromPoint','pointermove']:
            self.assertIn(token,app)
        for token in ['.preview-drop-before:before','.preview-drop-after:after','.preview-drop-inside','.preview-drop-column-active','.preview-drag-ghost','touch-action:none']:
            self.assertIn(token,css)
        self.assertIn('.preview-drag-handle,.preview-drag-ghost{display:none!important}',css)

    def test_v39_drag_is_transactional_and_uses_preview_history(self):
        app=(ROOT/'src/app.js').read_text(encoding='utf8')
        segment=app[app.index('function commitPreviewDrag'):app.index('function bindPreviewDrag')]
        self.assertIn('previewMutate(',segment)
        self.assertIn("success:'Orden actualizado'",segment)

class V40DirectBlockDragContractTests(unittest.TestCase):
    def test_v40_preview_supports_direct_block_drag_with_accidental_drag_guards(self):
        app=(ROOT/'src/app.js').read_text(encoding='utf8')
        css=(ROOT/'styles.css').read_text(encoding='utf8')
        self.assertIn('function bindPreviewBodyDrag(paper)',app)
        self.assertIn('function previewPointerBlocked',app)
        self.assertIn('previewBodyDragPending',app)
        self.assertIn("threshold=pointerType==='mouse'?6:12",app)
        self.assertIn("Date.now()-pending.startedAt<180",app)
        self.assertIn("el.dataset?.previewEdit",app)
        self.assertIn('.preview-drag-selected',css)
        self.assertIn('touch-action:pan-y pinch-zoom',css)

class V41PreviewUiUxContractTests(unittest.TestCase):
    def test_v41_selected_blocks_keyboard_controls_and_nested_toolbar_suppression(self):
        app=(ROOT/'src/app.js').read_text(encoding='utf8')
        css=(ROOT/'styles.css').read_text(encoding='utf8')
        engine=(ROOT/'src/template-engine-base.js').read_text(encoding='utf8')
        self.assertIn('tabindex="0" role="group"',engine)
        self.assertIn('aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Enter Escape"',engine)
        self.assertIn('function movePreviewByKeyboard',app)
        self.assertIn("e.altKey&&(e.key==='ArrowUp'||e.key==='ArrowDown')",app)
        self.assertIn('.preview-drag-selected>.preview-entry-controls',css)
        self.assertIn('.layout-section:has([data-preview-entry]:focus-within)>.preview-section-controls',css)
        self.assertIn('.layout-section:has([data-preview-entry].preview-drag-selected)>.preview-section-controls',css)

    def test_v41_drag_autoscroll_is_continuous_and_rerender_cancels_interaction(self):
        app=(ROOT/'src/app.js').read_text(encoding='utf8')
        self.assertIn('function trackPreviewDragPointer',app)
        self.assertIn('setInterval(()=>',app)
        self.assertIn('function cancelPreviewInteractions',app)
        segment=app[app.index('function renderPreview()'):app.index('function fontStack')]
        self.assertIn('cancelPreviewInteractions(paper)',segment)

    def test_v41_narrow_layout_has_preview_drawer_and_mobile_topbar_guardrails(self):
        html=(ROOT/'index.html').read_text(encoding='utf8')
        css=(ROOT/'styles.css').read_text(encoding='utf8')
        app=(ROOT/'src/app.js').read_text(encoding='utf8')
        for token in ['previewMobileBtn','previewCloseBtn','id="previewPane"']:
            self.assertIn(token,html)
        self.assertIn('body.preview-drawer-open .preview-pane',css)
        self.assertIn('.preview-toolbar>div:first-of-type',css)
        self.assertIn('.top-actions #focusBtn{display:none}',css)
        self.assertIn('function setPreviewDrawer(open)',app)
        self.assertIn("document.body.classList.contains?.('preview-drawer-open')",app);self.assertIn("e.key==='Escape'&&!e.defaultPrevented",app)

class V43PrintPaginationContractTests(unittest.TestCase):
    def test_print_allows_long_sections_to_fill_current_page_without_orphan_blank_space(self):
        css=(ROOT/'styles.css').read_text(encoding='utf8')
        app=(ROOT/'src/app.js').read_text(encoding='utf8')
        export_doc=(ROOT/'src/export-document.js').read_text(encoding='utf8')
        self.assertIn('@page{size:A4;margin:0}',css)
        self.assertIn('.resume-paper section{break-inside:auto!important;page-break-inside:auto!important}',css)
        self.assertIn('.resume-paper .resume-entry{break-inside:avoid-page;page-break-inside:avoid}',css)
        self.assertIn('.resume-paper h2{break-after:avoid-page;page-break-after:avoid}',css)
        self.assertIn('.resume-paper .layout-section.page-break-before{break-before:page!important;page-break-before:always!important}',css)
        self.assertIn('.resume-paper.print-one-page{',css)
        self.assertIn("onePage=s.pageStrategy==='one'||estimate.pages<=1",export_doc)
        self.assertIn("spec.onePage?' print-one-page':''",export_doc);self.assertIn("editable?' preview-edit-mode exact-export-editing':''",export_doc)
        self.assertIn('waitForExportPreviewFrame',app)
        self.assertIn('frame.contentWindow.print()',app)

class V43ExportPreviewParityContractTests(unittest.TestCase):
    def test_export_preview_uses_exact_editable_iframe_and_prints_clean_frame(self):
        html=(ROOT/'index.html').read_text(encoding='utf8')
        app=(ROOT/'src/app.js').read_text(encoding='utf8')
        css=(ROOT/'styles.css').read_text(encoding='utf8')
        export_doc=(ROOT/'src/export-document.js').read_text(encoding='utf8')
        self.assertIn('data-preview-surface="editor"',html)
        self.assertIn('data-preview-surface="export"',html)
        self.assertIn('id="exportPreviewFrame"',html)
        self.assertIn('id="exportPreviewHost"',html)
        self.assertIn('function prepareExactExportEditing',app)
        self.assertIn('bindPreviewEditor(paper,{allowExport:true})',app)
        self.assertIn("frame.srcdoc=buildExportDocument(r,{editable:previewEditMode})",app)
        self.assertIn("editBtn.disabled=previewMode!=='human'",app)
        self.assertIn("previewEditMode=false",app)
        self.assertIn("frame.contentWindow.print()",app)
        self.assertIn("buildExportDocument(resume,{assetVersion=EXPORT_ASSET_VERSION,editable=false,fillScale=1}",export_doc)
        self.assertIn("renderResumeHtml(resume,{interactive:editable})",export_doc)
        self.assertIn('exact-export-editing',export_doc)
        self.assertIn('.export-preview-frame{',css)
        self.assertIn('.export-preview-scaler{',css)




class V48ExportAutoFillContractTests(unittest.TestCase):
    def test_exact_export_auto_fill_is_measured_and_shared_with_direct_pdf(self):
        app=(ROOT/'src/app.js').read_text(encoding='utf8')
        export_doc=(ROOT/'src/export-document.js').read_text(encoding='utf8')
        css=(ROOT/'styles.css').read_text(encoding='utf8')
        self.assertIn('function applyExportAutoFill',app)
        self.assertIn('function exportAutoFillMeasurement',app)
        self.assertIn('maxByFont=16.333/baseFont',app)
        self.assertIn('Math.min(1.48,maxByFont)',app)
        self.assertIn('buildExportPdfPayload(current(),{fillScale:exportAutoFillScale()})',app)
        self.assertIn('Auto Fill ${Math.round((Number(scale)||1)*100)}%',app)
        self.assertIn('id="exportFillContent"',export_doc)
        self.assertIn('--export-fill-scale',export_doc)
        self.assertIn("Math.min(1.6,Number(fillScale)||1)",export_doc)
        self.assertIn('.resume-paper>.export-fill-content{',css)
        self.assertIn('width:calc(100% / var(--export-fill-scale))',css)
        self.assertIn('transform:scale(var(--export-fill-scale))',css)

class V48MobileExportAccessibilityContractTests(unittest.TestCase):
    def test_mobile_export_filename_can_wrap_and_import_file_has_accessible_name(self):
        app=(ROOT/'src/app.js').read_text(encoding='utf8')
        css=(ROOT/'styles.css').read_text(encoding='utf8')
        self.assertIn('id="importFile" type="file" accept=".pdf,.docx,.txt,.json" aria-label="Seleccionar CV para importar"',app)
        self.assertIn('.export-filename code{',css)
        self.assertIn('overflow-wrap:anywhere',css)
        self.assertIn('word-break:break-word',css)
        self.assertIn('max-width:100%',css)

class V48PrintPreviewQaContractTests(unittest.TestCase):
    def test_export_preview_print_resets_screen_only_padding_and_shadow(self):
        css=(ROOT/'styles.css').read_text(encoding='utf8')
        screen_rule='.paper-stage.export-preview-stage{background:#dfe3e8;padding:18px 22px 36px}'
        print_rule='.paper-stage,.paper-stage.export-preview-stage{padding:0!important;background:#fff!important;min-height:0!important;display:block!important}'
        self.assertIn(screen_rule,css)
        self.assertIn(print_rule,css)
        self.assertIn('.resume-paper,.resume-paper.export-preview{box-shadow:none!important;margin:0!important}',css)
        self.assertIn('.preview-pane{overflow:visible!important;container-type:normal!important}',css)
        self.assertGreater(css.rfind(print_rule),css.find(screen_rule))

    def test_preview_toolbar_uses_container_layout_without_shrinking_segmented_controls(self):
        css=(ROOT/'styles.css').read_text(encoding='utf8')
        self.assertIn('.preview-pane{container-type:inline-size;container-name:preview-pane}',css)
        self.assertIn('.preview-toolbar .segmented{min-width:max-content}',css)
        self.assertIn('@container preview-pane (max-width:720px)',css)
        self.assertIn('@container preview-pane (max-width:430px)',css)
        self.assertIn('.preview-editbar{top:96px}',css)
        self.assertIn('.preview-editbar{top:132px}',css)

    def test_runtime_print_page_size_follows_resume_paper(self):
        html=(ROOT/'index.html').read_text(encoding='utf8')
        app=(ROOT/'src/app.js').read_text(encoding='utf8')
        self.assertIn('id="runtimePrintPageStyle"',html)
        self.assertIn('function syncPrintPageSize',app)
        self.assertIn("r?.settings?.paper==='letter'?'Letter':'A4'",app)
        self.assertNotIn('pág. planificada(s)',app)

class V48ResumeIntelligenceContractTests(unittest.TestCase):
    def test_resume_intelligence_features_are_wired_into_product_surfaces(self):
        app=(ROOT/'src/app.js').read_text(encoding='utf8')
        intelligence=(ROOT/'src/resume-intelligence.js').read_text(encoding='utf8')
        html=(ROOT/'index.html').read_text(encoding='utf8')
        self.assertIn('export function cvScore',intelligence)
        self.assertIn('export function exportChecklist',intelligence)
        self.assertIn('export function impactQuestions',intelligence)
        self.assertIn('export function interviewQuestions',intelligence)
        self.assertIn('export function mergeResumeContent',intelligence)
        self.assertIn('export function professionalFilename',intelligence)
        self.assertIn('createTargetedVariantFromMaster',app)
        self.assertIn('QA visual de exportación',app)
        self.assertIn('Checklist de envío',app)
        self.assertIn('Impact Lab',app)
        self.assertIn('Interview Coach',app)
        self.assertIn('Comparar plantillas',app)
        self.assertIn('Fusionar con CV actual',app)
        self.assertIn('Descargar PDF directo',app)
        self.assertIn('/api/export-pdf',app)
        self.assertIn('releaseHash', (ROOT/'src/resume-workbench.js').read_text(encoding='utf8'))
        self.assertIn('id="zoomFitPage"',html)
        self.assertIn('id="zoomFitWidth"',html)

class V44ArchitectureContractTests(unittest.TestCase):
    def test_v44_release_tool_and_new_modules_are_versioned(self):
        tool=(ROOT/'tools/release.py').read_text(encoding='utf8');sw=(ROOT/'sw.js').read_text(encoding='utf8');pkg=(ROOT/'package.json').read_text(encoding='utf8')
        self.assertEqual((ROOT/'tools/release.py').relative_to(ROOT).as_posix(),'tools/release.py');self.assertIn('src/version.js',tool);self.assertIn('server.py',tool);self.assertIn('run.bat',tool)
        for name in ['version.js','career-pack.js','evidence.js','page-tools.js','durable-store.js','tab-sync.js']:self.assertIn(f'./src/{name}?v=48',sw)
        self.assertIn('src/durable-store.js',pkg);self.assertIn('src/tab-sync.js',pkg)

    def test_v44_docx_export_roundtrips_through_python_importer(self):
        import subprocess
        from server_lib.resume_parser import extract_document
        code="""import {defaultResume} from './src/schema.js';import {buildDocxBytes} from './src/exporters.js';const r=defaultResume();r.basics.fullName='QA Cross Runtime';r.experience[0].company='Empresa Cross Runtime';r.experience[0].bullets=[{id:'b',text:'Automaticé procesos y reduje tiempos 25%.'}];process.stdout.write(Buffer.from(buildDocxBytes(r)));"""
        raw=subprocess.run(['node','--input-type=module','-e',code],cwd=ROOT,check=True,capture_output=True).stdout
        parsed=extract_document(raw,'qa.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        self.assertIn('QA Cross Runtime',parsed['text']);self.assertIn('Empresa Cross Runtime',parsed['text']);self.assertIn('25%',parsed['text'])

class V46DurablePrimaryContractTests(unittest.TestCase):
    def test_v46_indexeddb_is_authoritative_with_journal_and_sync_index(self):
        app=(ROOT/'src/app.js').read_text(encoding='utf8');durable=(ROOT/'src/durable-store.js').read_text(encoding='utf8')
        self.assertIn("const JOURNAL_PREFIX=storageKey('journal'), JOURNAL=`${JOURNAL_PREFIX}-${TAB_INSTANCE}`",app)
        self.assertIn('persistState(localStorage,JOURNAL,state)',app)
        self.assertIn('expectedRevision',app);self.assertIn('clearCommittedLibraryCache(revision',app)
        self.assertIn("durableStorageStatus='IndexedDB · guardado durable confirmado'",app)
        self.assertIn('const DB_VERSION=2',durable);self.assertIn('compareDurableEnvelopes',durable);self.assertIn('digest:jsonDigest',durable)

    def test_v46_boot_guard_blocks_edits_until_durable_authority_is_resolved(self):
        app=(ROOT/'src/app.js').read_text(encoding='utf8');css=(ROOT/'styles.css').read_text(encoding='utf8')
        self.assertIn('durableBooting=indexedDbAvailable()',app)
        self.assertIn("if(durableBooting){const label=$('#saveState')",app)
        self.assertIn('Cargando biblioteca durable…',app)
        self.assertIn('body.storage-booting .preview-pane{visibility:hidden}',css)

class V48ConcurrencyAndOfflineContractTests(unittest.TestCase):
    def test_v48_journal_is_isolated_per_tab_and_uses_compare_and_swap(self):
        app=(ROOT/'src/app.js').read_text(encoding='utf8');durable=(ROOT/'src/durable-store.js').read_text(encoding='utf8')
        self.assertIn("JOURNAL=`${JOURNAL_PREFIX}-${TAB_INSTANCE}`",app)
        self.assertIn('expectedRevision',durable);self.assertIn('currentRevision!==expectedRevision',durable)
        self.assertNotIn('captureStorage(localStorage,[STORE,JOURNAL,SYNC_INDEX]',app)

    def test_v48_service_worker_cached_response_absorbs_background_network_rejection(self):
        sw=(ROOT/'sw.js').read_text(encoding='utf8')
        self.assertIn("if(cached){void network.catch(()=>{});return cached}",sw);self.assertIn('cachePutQuietly',sw);self.assertIn('.catch(()=>{})',sw)
