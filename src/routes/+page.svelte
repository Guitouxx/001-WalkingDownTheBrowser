<script lang="ts">
	import 'css/main.css';
	import { keys } from "lodash-es";
	import { onMount } from 'svelte';
	import { ACESFilmicToneMapping, AmbientLight, Clock, Color, DirectionalLight, Fog, Group, MathUtils, Mesh, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, Scene, TorusGeometry, Vector2, Vector3, WebGLRenderer } from 'three';
	import { store as browserStore } from "./store.svelte";
	import { STORAGE } from './store.svelte.ts';
	import type { BrowserSharedDatas } from './types.ts';

  //----- Vars

  let clock : Clock;
  let renderer : WebGLRenderer;
  let scene : Scene;
  let camera : PerspectiveCamera;
  
  let container : Group;
  let mesh : Mesh;
  
  let wrapperEl : HTMLElement;
  
  let sharedDatas : BrowserSharedDatas;
  let meMaster : boolean;

  let isMouseDown = false;
  let viewOffset : Vector2 = new Vector2();

  //----- Methods

  const initThree = () => {
    renderer = new WebGLRenderer({
      alpha: false,
      antialias: true
    });
    //ToneMapping & Shadows
		renderer.toneMapping = ACESFilmicToneMapping;
		renderer.toneMappingExposure = 0.9;
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    wrapperEl.appendChild(renderer.domElement);
  }

  const initScene = () => {
		const color = new Color('#9ee9ef');
    
    //Scene Config
    scene = new Scene();
		scene.background = color;
		scene.fog = new Fog(color, 25, 27);

    camera = new PerspectiveCamera(50, renderer.domElement.offsetWidth / renderer.domElement.offsetHeight, 0.1, 50);
    camera.position.z = 5;

    // Main Container
		container = new Group();
		scene.add(container);

    //Main Mesh
    mesh = new Mesh(new TorusGeometry( 10, 5, 20, 100 ), new MeshStandardMaterial({color:"#ABFFAB"}));
    mesh.scale.setScalar(0.05);
    mesh.castShadow = true;
    scene.add(mesh);

    //add lights
		const ambientLight = new AmbientLight('#FFF', 0.5);
    scene.add(ambientLight);
		const light = new DirectionalLight('#FFF', 1);
		light.position.set(5, 10, 7.5);
		light.castShadow = true;
		light.shadow.camera.near = 5;
		light.shadow.camera.far = 20;
		light.shadow.camera.left = -10;
		light.shadow.camera.right = 10;
		light.shadow.mapSize.width = 1024;
		light.shadow.mapSize.height = 1024
    scene.add(light);

		//ground
		const ground = new Mesh(new PlaneGeometry(1, 1), new MeshStandardMaterial({ color: '#9f9f9f' }));
		ground.scale.set(50, 50, 1);
		ground.rotation.x = -Math.PI / 2;
		ground.receiveShadow = true;
		ground.position.y = -1;
    scene.add(ground);

		// //add browser
		browserStore.addBrowser();
		browserStore.update();

    //start a threejs clock
    clock = new Clock(true);
  }

  const initEvents = () => {
    window.addEventListener('beforeunload', onUnload);
		renderer.domElement.addEventListener('mousedown', onMouseDown);
		renderer.domElement.addEventListener('mouseup', onMouseUp);
  }

  const render = () => {
    requestAnimationFrame(render);

    const delta = clock.getDelta();

    // -------- Manage Cameras view offset
		const currentViewOffset = browserStore.current;
		if (currentViewOffset) {
			const speed = 10;
			viewOffset.x = MathUtils.damp(viewOffset.x, currentViewOffset.x, speed, delta);
			viewOffset.y = MathUtils.damp(viewOffset.y, currentViewOffset.y, speed, delta);

			camera.setViewOffset(
				window.screen.width,
				window.screen.height,
				viewOffset.x,
				viewOffset.y,
				currentViewOffset.width,
				currentViewOffset.height
			);
		}
		// -------- Manage Cameras view offset

    // // walking / running
		if (mesh) {
			sharedDatas = browserStore.getStorage(STORAGE.troisd);
			meMaster = browserStore.current?.id === sharedDatas.command;

			if (!keys(sharedDatas).length) return;

			// Update Animation
			if (meMaster) {
				
					let direction = mesh.position.x > sharedDatas.targetPoint ? -0.05 : 0.05;
					mesh.position.x += direction;

					// Detect browser edge collision
					if (direction < 0 && mesh.position.x < sharedDatas.targetPoint) {
						mesh.position.x = sharedDatas.targetPoint;
					}
					if (direction > 0 && mesh.position.x > sharedDatas.targetPoint) {
						mesh.position.x = sharedDatas.targetPoint;
					}
				

				// Manage rotation
				mesh.rotation.y += 0.02;

				//save infos
				browserStore.save3dInfos({
					...sharedDatas,
					meshPosition: mesh.position.x,
					meshRotation: mesh.rotation.y,
				});

			} else {
				mesh.rotation.y = sharedDatas.meshRotation;
				mesh.position.x = sharedDatas.meshPosition;
			}
		}

    // save window position and size
		browserStore.update();

    renderer.render(scene, camera);
  }

  const resize = () => {
    // adapt screen size
		const screenRatio = Math.max(1, window.screen.width / 1440);
		camera.position.z = 5 * screenRatio;
		camera.position.y = 1.2;
		camera.lookAt(new Vector3());

    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  //----- Utils Methods

  /**
	 * get pixel X value intro a x position inside our Full camera view offset
	 * @param x mouse X
	 * @returns Number (x position)
	 */
	const get3DpointX = (x: number) : number => {
		if (!browserStore.current) return 0;

		x += browserStore.current.x; // add browser position

    // get stage dimension
    const vFov = camera.fov * (Math.PI / 180);
    const height = 2 * Math.tan(vFov / 2) * (container.position.z - camera.position.z);
    const width = height * camera.aspect;

    // get 3d equivalent
    const position = (x / window.screen.width) * 2 - 1;
		return position * (-width / 2);
	}


  //----- Event Handlers

  const onUnload = () => {
    browserStore.removeBrowser();
  }

  const onMouseDown = (e:MouseEvent) => {
    if (!browserStore.current) return;

		isMouseDown = true;

		// get 3d equivalient points
		const targetPoint = get3DpointX(e.clientX);
		
		//save infos with target points
		browserStore.save3dInfos({
			targetPoint,
			meshPosition: sharedDatas.meshPosition,
			meshRotation: sharedDatas.meshRotation,
			command: browserStore.current.id,
		});
  }

  const onMouseUp = () => {
    isMouseDown = false;
  }

  //----- Lifecycle
  
  onMount( () => {
    initThree();
    initScene();
    initEvents();
    resize();
    render();
  });

</script>

<svelte:window on:resize={resize} />

<div bind:this={wrapperEl} id="threejs-wrapper" class="fixed w-full h-full left-0 top-0"></div>
