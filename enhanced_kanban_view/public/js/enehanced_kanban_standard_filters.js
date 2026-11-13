// Show list-view style standard filters inside the Kanban view as
// dropdown multi-select controls.
frappe.provide("frappe.views");

// DocType-wise filters that should be available inline in the Kanban view.
// These are the same fields that are marked as "In List Filter" in the list view.
const kanban_standard_filters = {
	Opportunity: [
		"opportunity_owner", // Opportunity Owner
		"customer_name", // Customer (title field)
		"company_name", // Organization Name
		"territory", // Territory
		"status", // Status
	],
};

// Options for the multi-select dropdowns. Link fields are searched on the
// server (same as a Link control), Select fields use their static options and
// Data fields list the distinct values already used on the doctype.
function get_multiselect_options(doctype, df, txt) {
	const search = (txt || "").trim();

	if (df.fieldtype === "Link" && df.options) {
		return frappe.db.get_link_options(df.options, search).then((options) =>
			(options || []).map((option) => {
				// For User links, show the full name on top and the email
				// (the actual link value) below it.
				if (df.options === "User" && option.description) {
					return {
						label: option.description,
						value: option.value,
						description: option.value,
					};
				}

				return {
					label: option.label || option.value,
					value: option.value,
					description: option.description || "",
				};
			})
		);
	}

	if (df.fieldtype === "Select") {
		return (df.options || "")
			.split("\n")
			.map((option) => option.trim())
			.filter(Boolean)
			.filter((option) => !search || option.toLowerCase().includes(search.toLowerCase()))
			.map((option) => ({ label: __(option), value: option, description: "" }));
	}

	// Data-like field: show values that are actually in use.
	return frappe.db
		.get_list(doctype, {
			fields: [df.fieldname],
			filters: search ? { [df.fieldname]: ["like", `%${search}%`] } : {},
			distinct: true,
			limit: 50,
			order_by: `${df.fieldname} asc`,
		})
		.then((rows) =>
			rows
				.map((row) => row[df.fieldname])
				.filter((value) => value !== null && value !== undefined && value !== "")
				.map((value) => ({ label: String(value), value, description: "" }))
		);
}

const original_KanbanView_class = frappe.views.KanbanView;

frappe.views.KanbanView = class KanbanView extends original_KanbanView_class {
	setup_filter_area() {
		const fieldnames = kanban_standard_filters[this.doctype];
		let deferred_filters = [];

		if (!this.hide_filters && fieldnames) {
			// Take over saved filters for our inline controls, so that the
			// FilterArea does not render them a second time as filter pills.
			deferred_filters = this.consume_multi_select_filters(fieldnames);
		}

		const filter_area_promise = super.setup_filter_area();

		if (!this.hide_filters && fieldnames) {
			this.patch_filter_area();
			this.make_kanban_standard_filters();
			return Promise.all([
				filter_area_promise,
				...deferred_filters.map(([fieldname, values]) =>
					this.set_multi_select_value(fieldname, values)
				),
			]);
		}

		return filter_area_promise;
	}

	// FilterArea.get_standard_filters() does not know about array values, so
	// an empty multi-select would produce an invalid "in []" filter.
	patch_filter_area() {
		if (!this.filter_area || this.filter_area._kanban_multi_select_patched) {
			return;
		}

		const get_standard_filters =
			this.filter_area.get_standard_filters.bind(this.filter_area);

		this.filter_area.get_standard_filters = () =>
			get_standard_filters().filter(
				(filter) => !(Array.isArray(filter[3]) && filter[3].length === 0)
			);
		this.filter_area._kanban_multi_select_patched = true;
	}

	consume_multi_select_filters(fieldnames) {
		const remaining = [];
		const deferred = [];

		(this.filters || []).forEach((filter) => {
			const [doctype, fieldname, condition, value] = filter;

			if (
				doctype === this.doctype &&
				fieldnames.includes(fieldname) &&
				(condition === "=" || condition === "in")
			) {
				const values = (
					Array.isArray(value) ? value : String(value ?? "").split(",")
				)
					.map((val) => (typeof val === "string" ? val.trim() : val))
					.filter((val) => val !== null && val !== undefined && val !== "");

				if (values.length) {
					deferred.push([fieldname, values]);
				}
				return;
			}

			remaining.push(filter);
		});

		this.filters = remaining;
		return deferred;
	}

	make_kanban_standard_filters() {
		this.standard_filters_wrapper = this.page.page_form.find(
			".standard-filter-section"
		);

		if (!this.standard_filters_wrapper.length) {
			this.standard_filters_wrapper = $(
				'<div class="standard-filter-section flex kanban-standard-filter-section"></div>'
			).appendTo(this.page.page_form);
		}

		this.standard_filters_wrapper.addClass("kanban-standard-filter-section");

		// The Kanban view hides the page form by default. Show it so that the
		// standard filters are visible, just like in the list view.
		this.page.page_form.removeClass("hide").show();
		this.page.page_form.addClass("kanban-standard-filters");

		kanban_standard_filters[this.doctype].forEach((fieldname) => {
			// Avoid adding the same field twice when the page is reused.
			if (this.page.fields_dict[fieldname]) {
				return;
			}

			const df = { ...frappe.meta.get_docfield(this.doctype, fieldname) };
			if (!df || !frappe.model.is_value_type(df.fieldtype)) {
				return;
			}

			if (!frappe.perm.has_perm(this.doctype, df.permlevel)) {
				return;
			}

			const control = this.page.add_field(
				{
					fieldtype: "MultiSelectList",
					label: __(df.label, null, df.parent),
					fieldname: df.fieldname,
					get_data: (txt) => get_multiselect_options(this.doctype, df, txt),
					// Multiple selected values are matched with a single
					// "in" filter.
					condition: "in",
					onchange: () => this.filter_area?.debounced_refresh_list_view(),
					is_filter: 1,
					ignore_link_validation: true,
				},
				this.standard_filters_wrapper
			);

			this.patch_multi_select_clear(control);
		});
	}

	// The stock MultiSelectList ignores empty values in set_value(), which
	// means "Clear all filters" would not clear these fields.
	patch_multi_select_clear(control) {
		const set_value = control.set_value.bind(control);

		control.set_value = (value) => {
			const is_empty =
				value === null ||
				value === undefined ||
				value === "" ||
				(Array.isArray(value) && value.length === 0);

			if (!is_empty) {
				return set_value(value);
			}

			control.values = [];
			control._selected_values = [];
			control.update_status();
			control.set_selectable_items(control._options || []);
			control.parse_validate_and_set_in_model("");
			return Promise.resolve();
		};
	}

	async set_multi_select_value(fieldname, values) {
		const control = this.page.fields_dict[fieldname];
		if (!control) return;

		// Load options first so the control can show labels instead of raw
		// values. Suppress onchange: these values are already part of the
		// initial refresh.
		try {
			await control.set_options();
		} catch (e) {
			// Options are optional; values are still applied below.
		}

		const onchange = control.df.onchange;
		control.df.onchange = null;

		try {
			await control.set_value(values);
		} finally {
			control.df.onchange = onchange;
		}
	}
};
