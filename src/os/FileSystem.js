export class FileSystem {
  constructor() {
    this.root = { name: '/', type: 'directory', children: [] };
  }

  writeFile(path, content) {
    // Logic to parse path and navigate nested structure
    console.log(`Writing to ${path}: ${content}`);
  }

  readFile(path) {
    return `Content of ${path}`;
  }
}
