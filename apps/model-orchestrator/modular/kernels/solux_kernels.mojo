"""Solux performance kernels — Python extension module for the orchestrator."""

from std.os import abort
from std.python import Python, PythonObject
from std.python.bindings import PythonModuleBuilder


def _sigmoid(x: Float64) raises -> Float64:
    var pymath = Python.import_module("math")
    if x > 20.0:
        return 1.0
    if x < -20.0:
        return 0.0
    return 1.0 / (1.0 + Float64(py=pymath.exp(-x)))


def batch_sigmoid_scores(
    matrix: PythonObject, weights: PythonObject, bias: PythonObject
) raises -> PythonObject:
    var np = Python.import_module("numpy")
    var b = Float64(py=bias)
    var builtins = Python.import_module("builtins")
    var w_keys = builtins.list(weights.keys())
    var w_len = Int(len(w_keys))
    var n = Int(len(matrix))
    var out = np.empty(n, dtype=np.float64)

    for i in range(n):
        var row = matrix[i]
        var logit = b
        for j in range(w_len):
            var key = w_keys[j]
            var w_val = Float64(py=weights[key])
            var x_val = Float64(0.0)
            if row.__contains__(key):
                x_val = Float64(py=row[key])
            logit += w_val * x_val
        out[i] = _sigmoid(logit)

    return out


def batch_sigmoid_scores_matrix(
    matrix: PythonObject, weight_vector: PythonObject, bias: PythonObject
) raises -> PythonObject:
    var np = Python.import_module("numpy")
    var m = np.asarray(matrix, dtype=np.float64)
    var w = np.asarray(weight_vector, dtype=np.float64).reshape(-1)
    var n = Int(len(m))
    var f = Int(len(w))
    var b = Float64(py=bias)
    var out = np.empty(n, dtype=np.float64)

    for i in range(n):
        var logit = b
        for j in range(f):
            logit += Float64(py=m[i, j]) * Float64(py=w[j])
        out[i] = _sigmoid(logit)

    return out


def cosine_similarity_rows(query: PythonObject, matrix: PythonObject) raises -> PythonObject:
    var np = Python.import_module("numpy")
    var pymath = Python.import_module("math")
    var q = np.asarray(query, dtype=np.float64).reshape(-1)
    var m = np.asarray(matrix, dtype=np.float64)
    var n = Int(len(m))
    var out = np.empty(n, dtype=np.float64)

    var q_norm = Float64(0.0)
    var q_len = Int(len(q))
    for i in range(q_len):
        var v = Float64(py=q[i])
        q_norm += v * v
    q_norm = Float64(py=pymath.sqrt(q_norm))
    if q_norm == 0.0:
        return out

    for r in range(n):
        var dot = Float64(0.0)
        var m_norm = Float64(0.0)
        for j in range(q_len):
            var mv = Float64(py=m[r, j])
            var qv = Float64(py=q[j])
            dot += mv * qv
            m_norm += mv * mv
        m_norm = Float64(py=pymath.sqrt(m_norm))
        if m_norm == 0.0:
            out[r] = 0.0
        else:
            out[r] = dot / (q_norm * m_norm)

    return out


def l2_normalize_rows(matrix: PythonObject) raises -> PythonObject:
    var np = Python.import_module("numpy")
    var pymath = Python.import_module("math")
    var m = np.asarray(matrix, dtype=np.float64)
    var n = Int(len(m))
    if n == 0:
        return m
    var f = Int(py=m.shape[1])
    var out = np.empty(m.shape, dtype=np.float64)

    for r in range(n):
        var norm = Float64(0.0)
        for j in range(f):
            var v = Float64(py=m[r, j])
            norm += v * v
        norm = Float64(py=pymath.sqrt(norm))
        if norm == 0.0:
            for j in range(f):
                out[r, j] = 0.0
        else:
            for j in range(f):
                out[r, j] = Float64(py=m[r, j]) / norm

    return out


def mojo_status() raises -> PythonObject:
    return PythonObject("ready")


@export
def PyInit_solux_kernels() abi("C") -> PythonObject:
    try:
        var m = PythonModuleBuilder("solux_kernels")
        m.def_function[batch_sigmoid_scores](
            "batch_sigmoid_scores",
            docstring="Batch logistic scores from feature dict rows and weight dict.",
        )
        m.def_function[batch_sigmoid_scores_matrix](
            "batch_sigmoid_scores_matrix",
            docstring="Batch logistic scores from dense matrix and weight vector.",
        )
        m.def_function[cosine_similarity_rows](
            "cosine_similarity_rows",
            docstring="Cosine similarity between query vector and matrix rows.",
        )
        m.def_function[l2_normalize_rows](
            "l2_normalize_rows",
            docstring="L2-normalize rows of a 2D matrix.",
        )
        m.def_function[mojo_status]("mojo_status", docstring="Kernel module status.")
        return m.finalize()
    except e:
        abort(String("PyInit solux_kernels failed: ", e))
