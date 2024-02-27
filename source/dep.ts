// @ts-ignore
import parseYarnLock from 'parse-yarn-lock';

const getPackageName = (packageWithVersion: string) => packageWithVersion.split('@').slice(0, -1).join('@')

export const showDepGraph = async (repo: string, packageName: string) => {
	const lockfile = await fetch(
		`https://raw.githubusercontent.com/Thinkei/${repo}/master/yarn.lock`,
		{
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${process.env['GITHUB_TOKEN'] as string}`
			}
		}
	)
		.then(async res => {
			if (res.status !== 200) {
				console.log(await res.text());
				return null;
			}

			return res.text();
		})
		.catch(() => {
			return null;
		});

	if (!lockfile) {
		console.log('Repo or package name is invalid');
		return;
	}

	const packageFile = await fetch(
		`https://raw.githubusercontent.com/Thinkei/${repo}/master/package.json`,
		{
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${process.env['GITHUB_TOKEN'] as string}`
			}
		}
	)
		.then(async res => {
			if (res.status !== 200) {
				console.log(await res.text());
				return null;
			}

			return res.json();
		})
		.catch(() => {
			return null;
		});

	const devDeps = packageFile.devDependencies;

	const lock = parseYarnLock.default(lockfile) as { object: Record<string, any>, type: Record<string, any> };

	const nodes = new Set<string>;
	const edges = [];
	const graph = new Map<string, string[]>;
	const edgeSet = new Set;

	for (const [key, value] of Object.entries(lock.object)) {
		const name = key.substring(0, key.indexOf("@", 1));
		const source = `${name}@${value.version}`;
		nodes.add(source);
		for (const [depkey, depvalue] of Object.entries({ ...value.optionalDependencies, ...value.dependencies })) {
			const targetKey = `${depkey}@${depvalue}`;
			const targetObject = lock.object[targetKey];
			const target = targetObject ? `${depkey}@${targetObject.version}` : targetKey;

			const edgeKey = `${source} ========= ${target}`
			if (!edgeSet.has(edgeKey)) {
				edgeSet.add(edgeKey);
				edges.push([source, target]);
				const edgeSource = graph.get(source as string) || [];
				if (!edgeSource.includes(target)) {
					edgeSource.push(target);
				}
				graph.set(source, edgeSource);
			}
		}
	}

	const roots = new Set(nodes);
	const rootsOfNode: Record<string, Set<string>> = {};

	for (const [_, target] of edges) {
		roots.delete(target || '');
	}

	const inPath = new Set<string>;

	const dfs = (currNode: string, rootNode: string) => {
		if (inPath.has(currNode)) return;

		inPath.add(currNode);

		rootsOfNode[currNode]?.add(rootNode);

		for (const neighbour of graph.get(currNode) || []) {
			dfs(neighbour, rootNode);
		}

		inPath.delete(currNode);
	}

	for (const node of nodes) {
		rootsOfNode[node] = new Set<string>;
	}

	for (const root of roots) {
		dfs(root, root);
	}

	nodes.forEach(node => {
		if (getPackageName(node) === packageName) {
			const rootDeps = Array.from(rootsOfNode[node]?.values() || '')
				.filter((dep) => {
					const depName = getPackageName(dep);
					const rootVer = devDeps[depName];

					if (rootVer) {
						return false;
					}

					return dep;
				});

			console.log(
				'\nVersion:', node,
				'\nRoot dependencies:', Array.from(rootsOfNode[node]?.values() || ''),
				'\nRoot dependencies (Without devs):', rootDeps,
				'\n\n================================================================',
			);
		}
	});
};
