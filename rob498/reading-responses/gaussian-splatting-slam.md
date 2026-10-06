Paper:    Matsuki, Murai, Kelly and Davison, Gaussian Splatting SLAM, CVPR 2024
Reader:   [Your Name] (minqianw)
Seminar:  I / II / III / IV
Discussed with:  nobody

## 1. The claim

A cloud of 3D Gaussians optimised directly against pixels can be the tracker,
the keyframe selector and the map of a live monocular SLAM system all at once,
with no feature front-end, depth network or borrowed tracking module, and it
tracks at least as well as the layered designs it replaces. The rival is
the view that photorealistic representations are something you fit after a
conventional SLAM system has already supplied the poses.

## 2. The evidence

The monocular rows of Table 1 carry it: GS-SLAM against DSO, DROID-VO and
DepthCov-VO on three TUM sequences, all without loop closure. If Gaussians
tracked worse than DSO, the paper would be a renderer with a pose estimator
attached. The comparison does not isolate the representation. Table 3 and
Table 11 show that ATE roughly doubles without keyframe selection and reaches
tens of centimetres without pruning, so what wins is Gaussians plus a tuned set
of heuristics, measured on three sequences with keyframe-only ATE. The
convergence-basin test (Table 6) does isolate the representation, but it is
localisation against a nine-view map, not SLAM. And the supplementary's own
ORB-SLAM+3DGS rows (Tables 15 and 16) beat the unified system on TUM in both
ATE and PSNR, so the claim that survives is "sufficient and competitive", not
"better".

## 3. The weakest assumption

That low photometric error from near the trajectory means the geometry is
right. Rendering is scored on every fifth frame of the same trajectory, so the
"novel" views sit centimetres from training keyframes, and no geometric metric
is reported against Replica's ground-truth meshes, even though NICE-SLAM and
Point-SLAM report depth L1 and completion on the same sequences. Fig. 3 shows
what the formulation permits: Gaussians stretched along the viewing ray that
render correctly from the trajectory and wrongly from the side; the isotropic
loss is a prior against this, not a check of it. If the assumption fails,
the map is a trajectory re-renderer, and anything downstream that reads it as
geometry (collision checking, relocalisation from a new viewpoint, the
loop-closure deformation the authors propose) inherits errors the photometric
loss cannot see.

## 4. What you would run next

Run GS-SLAM and ESLAM on Replica room0 and office0 (RGB-D, plus GS-SLAM
monocular). After each run, render colour and depth from poses displaced
laterally from the trajectory by 0, 0.1, 0.25, 0.5 and 1.0 m, and score PSNR and
depth L1 against the ground-truth mesh at each offset. I expect both metrics to
degrade with offset faster for GS-SLAM than for ESLAM, and monocular much faster
than RGB-D, because only multi-view pruning constrains depth along the ray. If
instead GS-SLAM's depth L1 stays within about twice ESLAM's out to 0.5 m and its
PSNR falls no faster, then the isotropic loss plus pruning really does pin the
geometry, and I would treat the map as geometric rather than view-dependent.
