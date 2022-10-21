const toCamel = (s) =>
	s.replace(/([-_][a-z])/gi, $1 =>
		$1.toUpperCase().replace('-', '').replace('_', '')
	)

function isArray(a) {
	return Array.isArray(a)
}

function isObject(o) {
	return o === Object(o) && !isArray(o) && typeof o !== 'function'
}

function keysToCamel(o) {
	if (isObject(o)) {
		const n = {}

		Object.keys(o).forEach((k) => {
			n[toCamel(k)] = keysToCamel(o[k])
		})

		return n
	}
	if (isArray(o)) {
		return o.map((i) => keysToCamel(i))
	}

	return o
}

module.exports = {keysToCamel}
