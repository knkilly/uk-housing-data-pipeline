"""
API route handlers — async wrappers around db.py query functions.
All DB calls run in a thread pool so they don't block the event loop.
"""

import asyncio
from functools import partial

from fastapi import APIRouter, Query

from app import db

router = APIRouter(prefix="/api")


async def _run(fn, *args):
    """Run a sync db function in the default thread pool executor."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(fn, *args))


@router.get("/overview")
async def get_overview():
    return await _run(db.overview)


@router.get("/area-labels")
async def get_area_labels():
    return await _run(db.area_labels)


@router.get("/area/{code}/summary")
async def get_area_summary(code: str):
    return await _run(db.area_summary, code.upper())


@router.get("/area/{code}/property-types")
async def get_area_property_types(code: str):
    return await _run(db.area_property_types, code.upper())


@router.get("/area/{code}/monthly")
async def get_area_monthly(code: str):
    return await _run(db.area_monthly, code.upper())


@router.get("/area/{code}/heatmap")
async def get_area_heatmap(
    code: str,
    property_type: str = Query("All"),
    price_min: int = Query(0),
    price_max: int = Query(99999),
):
    return await _run(db.area_heatmap, code.upper(), property_type, price_min, price_max)


@router.get("/area/{code}/districts")
async def get_area_districts(code: str):
    return await _run(db.area_districts, code.upper())


@router.get("/area/{code}/repeat-sales")
async def get_area_repeat_sales(code: str):
    return await _run(db.area_repeat_sales, code.upper())
