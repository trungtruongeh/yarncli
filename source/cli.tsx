#!/usr/bin/env node
import { program } from 'commander';
import { showDepGraph } from './dep.js';

program
	.command('dependency')
	.alias('dep')
	.description('dependency between packages')
	.argument('<repo>', 'repository')
	.argument('<name>', 'name of package to trace')
	.action((repo, name) => {
		showDepGraph(repo, name);
	});

program.parse();
