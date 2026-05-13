#  (2026-05-13)


### Bug Fixes

* **blog:** address review round 002 findings (TASK-0005) ([fcededc](https://github.com/antoniofulg/blog/commit/fcededc3b5867e96796be9de18b283036099c7d5))
* **blog:** address review round 006 findings (TASK-0005) ([ecd7570](https://github.com/antoniofulg/blog/commit/ecd75704ee319d5d40033be1d5ab3bcb732db758))
* **blog:** address review round 007 findings (TASK-0005) ([8794092](https://github.com/antoniofulg/blog/commit/87940920f175741b62305546368f3f147e229686))
* **blog:** address review round 009 findings (TASK-0005) ([fd253ed](https://github.com/antoniofulg/blog/commit/fd253ed74dc03fd12906bf2a1030449069b1188a))
* **blog:** normalize hreflang to BCP 47 canonical form (TASK-0005) ([e7c5972](https://github.com/antoniofulg/blog/commit/e7c5972985302db7dce600454b1642f0d21f2e00))
* **build:** disable import protection plugin ([#4](https://github.com/antoniofulg/blog/issues/4)) ([bc46987](https://github.com/antoniofulg/blog/commit/bc46987877395e9e66191d1036814574148fbfa7))
* **ci:** copy .env.example before run tests ([b1c2e3d](https://github.com/antoniofulg/blog/commit/b1c2e3db1576818a692f10168a76cfbc3b59cb64))
* **ci:** use production GHCR image and immutable tag for deploy ([8646454](https://github.com/antoniofulg/blog/commit/8646454b62792297a8334ce8a610a39f6d58329d))
* **deploy:** add CI=true to migration run for clean output ([8e9100c](https://github.com/antoniofulg/blog/commit/8e9100c50414e2a4c7033bdc540ed4843071eb24))
* **deploy:** replace drizzle-kit migrate with programmatic migrator ([#10](https://github.com/antoniofulg/blog/issues/10)) ([9b89244](https://github.com/antoniofulg/blog/commit/9b89244df6e3fabc74c7f5a394961de0e9f5e80f))
* **deploy:** start db and wait healthy before running migrations ([#7](https://github.com/antoniofulg/blog/issues/7)) ([897a002](https://github.com/antoniofulg/blog/commit/897a00278a3166b294741000ad7c18d67a3190de))
* **deploy:** sync docker-compose.prod.yml to VPS on every deploy ([#11](https://github.com/antoniofulg/blog/issues/11)) ([5dafef8](https://github.com/antoniofulg/blog/commit/5dafef884f7a94bc842fdbd4eaeb2ba7d062d056))
* **docker:** add migration deps to runner stage and CI docker-build job ([#5](https://github.com/antoniofulg/blog/issues/5)) ([7ad978f](https://github.com/antoniofulg/blog/commit/7ad978f26c2ffe206f073e638c73d588a5e81a65))
* **docker:** read pg credentials from .env, remove db port exposure i… ([#6](https://github.com/antoniofulg/blog/issues/6)) ([8686bbb](https://github.com/antoniofulg/blog/commit/8686bbb4b70c2c382be505a0b75d5cc0d4efe333))
* **indexer:** add lang to index_error log entry ([c055bc3](https://github.com/antoniofulg/blog/commit/c055bc310dee657f1d72ba11539e8f791da0773b))
* **review-002:** address all round-002 findings ([8219b29](https://github.com/antoniofulg/blog/commit/8219b29b875d038add5b0fdf479944c6d15ee145))


### Features

* **blog:** add i18n content structure and locale routing (TASK-0005) ([8c66a07](https://github.com/antoniofulg/blog/commit/8c66a07069d73ce5bf5013e55c025d361362c0f4))
