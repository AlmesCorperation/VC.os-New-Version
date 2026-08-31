# Nolona CLI Reference (VC.os)

Nolona is the container orchestration and management CLI for VC.os, inspired by the robustness of LXD/Termina. It provides comprehensive control over instance lifecycles, filesystems, and networking.

## Instance Lifecycle
- `nolona launch`: Create and start an instance from an image.
- `nolona init`: Create an instance without starting it.
- `nolona start`: Power on a stopped instance.
- `nolona stop`: Power off a running instance.
- `nolona restart`: Reboot a running instance.
- `nolona pause`: Freeze all runtime processes inside an instance.
- `nolona unpause`: Resume a paused instance.
- `nolona delete`: Permanently remove an instance and its data.

## Management & Inspection
- `nolona list`: List all local instances and their network states.
- `nolona info`: Display a highly detailed structural breakdown of an instance.
- `nolona exec`: Execute a command or drop into a shell inside an instance.
- `nolona console`: Attach directly to the boot console of an instance.
- `nolona monitor`: Listen to the live background events of the VC.os server.
- `nolona op`: List, view, or cancel active background jobs.

## Manipulation & Duplication
- `nolona clone`: Clone an existing instance into a brand-new copy.
- `nolona mv`: Rename an instance or migrate it between servers.
- `nolona file`: Handle direct file transfers (push/pull/edit/delete).
- `nolona snap`: Capture a point-in-time backup state of an instance.
- `nolona restore`: Rollback an instance to a selected snapshot state.

## System Configuration
- `nolona config`: Edit environment keys, runtime values, and security limits.
- `nolona profile`: Manage reusable settings groups applied to instances.
- `nolona net`: Configure network bridges, subnets, and instance attachments.
- `nolona store`: Manage underlying disk storage pools, volumes, and quotas.
- `nolona cluster`: Monitor and manage grouped multi-node VC.os environments.

## Templates & Security
- `nolona image`: Manage locally cached and imported distribution images.
- `nolona remote`: Interact with online registries.
- `nolona project`: Create isolated workspaces to group resources.
- `nolona auth`: Control specific API access policies and user authorizations.
- `nolona alias`: Create custom shortcuts for repetitive Nolona syntaxes.
