frappe.ui.form.on('Cargo Shipment Receipt', {

    // TODO: On Save set customer on the package that are not set!
    // TODO: Formatter for Package item?

    onload: function (frm) {
        // Adding the two possible ways to trigger a fetch for customer_name
        frm.add_fetch('package', 'customer_name', 'customer_name');
        frm.add_fetch('customer', 'customer_name', 'customer_name');

        // TODO: Set Query for cargo_shipment_receipt_warehouse_lines
	    frm.set_query('package', 'cargo_shipment_receipt_lines', () => {
            return {
                filters: {
                    status: ['not in', ['In Customs', 'Sorting', 'Available to Pickup', 'Finished']]
                }
            };
        });
    },

    refresh: function (frm) {
        // TODO: after UI release: Child table dont update after save(validate method sorts the child table)
        // TODO: Add a button to sort child table by customer name.
        // TODO: Add intro message when the cargo shipment is on a cargo shipment receipt
        // TODO: Add Progress: dashboard.add_progress or frappe.chart of type: percentage

        if (frm.is_new()) {
            return;
        }

        if (frm.doc.status === 'Awaiting Receipt') {
            frm.page.add_action_item(__('Mark as Sorting'), () => {
                frappe.call({
                    method: 'cargo_management.shipment_customization.doctype.cargo_shipment_receipt.actions.update_status',
                    args: {
                        source_doc_name: frm.doc.name,
                        new_status: 'Sorting'
                    }
                });
            });
        } else {
            frm.page.clear_actions_menu();
        }

        frm.add_custom_button(__('Sales Invoice'), () => {
            // TODO: Little hack? fix after new UI: Button should be hidden if change is made -> look in warehouse receipt change status action
            frm.save();

            frappe.call({
                method: 'cargo_management.shipment_customization.doctype.cargo_shipment_receipt.actions.make_sales_invoice',
                args: {doc: frm.doc},
                freeze: true,
                freeze_message: __('Creating Sales Invoice...')
            }).then(r => { // Return customers invoices
                frm.doc.cargo_shipment_receipt_lines.forEach((csrl) => {
                    console.log(csrl);
                    console.log(csrl.sales_invoice);
                    console.log(r.message);
                    console.log(r.message[csrl.customer]);

                    csrl.sales_invoice = r.message[csrl.customer]
                });

                frm.refresh_field('cargo_shipment_receipt_lines');
            });
        }, __('Create'));

        frm.page.set_inner_btn_group_as_primary(__('Create'));
    },

    cargo_shipment: function (frm) {
        if (!frm.doc.cargo_shipment) {
            return;
        }

        // We clear the table each time to avoid duplication
        frm.clear_table('cargo_shipment_receipt_warehouse_lines');
        frm.clear_table('cargo_shipment_receipt_lines');

        frappe.call({
            method: 'cargo_management.shipment_customization.doctype.cargo_shipment_receipt.actions.get_packages_and_wr_in_cargo_shipment',
            args: {cargo_shipment: frm.doc.cargo_shipment},
            freeze: true,
            freeze_message: __('Adding Packages...'),
        }).then(r => {

            // Adding All packages
            r.message.packages.forEach(package_doc => {
                let content_notes = package_doc.content;
                if (package_doc.total) { // Have a total value calculated
                    content_notes += '\n\nTotal: $' + package_doc.total;
                }

                frm.add_child('cargo_shipment_receipt_lines', {
                    'package': package_doc.name,
                    // 'item_code': package_doc.item_code, TODO: This is not working, because the package can have more than once item code
                    'customer': package_doc.customer,
                    'customer_name': package_doc.customer_name,
                    'carrier_est_weight': package_doc.carrier_est_weight,
                    'content': content_notes
                });
            });

            // Adding all Warehouse receipts
            r.message.warehouse_receipts.forEach(wr => frm.add_child('cargo_shipment_receipt_warehouse_lines', {'warehouse_receipt': wr}));

            // Refresh the modified tables inside the callback after execution is done!
            frm.refresh_field('cargo_shipment_receipt_warehouse_lines');
            frm.refresh_field('cargo_shipment_receipt_lines');
        });

    }
});

// Child Table
frappe.ui.form.on('Cargo Shipment Receipt Line', {
    // TODO: We should allow always customer to be read not read_only?

    // TODO: Add a button to trigger this info!
    gross_weight: function (frm, cdt, cdn) {
        frm.set_value('gross_weight', frm.get_sum('cargo_shipment_receipt_lines', 'gross_weight'));
    }

});